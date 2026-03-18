import cron from 'node-cron';
import db from '../../database/connection';
import { executeProject } from '../../orchestrator/engine';

type ScheduledJob = {
  id: string;
  task: cron.ScheduledTask;
};

const activeJobs = new Map<string, ScheduledJob>();
const runningSchedules = new Set<string>();

/**
 * Initialize the scheduler runtime.
 * Loads all enabled schedules from DB and starts cron jobs.
 */
export function initSchedulerRuntime() {
  const schedules: any[] = db.prepare(
    "SELECT * FROM schedules WHERE enabled = 1 AND trigger_type != 'manual' AND cron_expr != ''"
  ).all();

  console.log(`[Scheduler] Inizializzazione: ${schedules.length} automazioni attive`);

  for (const schedule of schedules) {
    startScheduleJob(schedule);
  }
}

/**
 * Start a cron job for a specific schedule.
 */
export function startScheduleJob(schedule: any): boolean {
  const { id, project_id, cron_expr, name } = schedule;

  // Stop existing job if any
  stopScheduleJob(id);

  // Validate cron expression
  if (!cron_expr || !cron.validate(cron_expr)) {
    console.log(`[Scheduler] Espressione cron non valida per "${name}": ${cron_expr}`);
    return false;
  }

  const task = cron.schedule(cron_expr, async () => {
    // Prevent concurrent runs of the same schedule
    if (runningSchedules.has(id)) {
      console.log(`[Scheduler] "${name}" già in esecuzione, skip`);
      return;
    }

    runningSchedules.add(id);
    const now = new Date().toISOString();
    console.log(`[Scheduler] Esecuzione automatica: "${name}" (${cron_expr})`);

    try {
      db.prepare('UPDATE schedules SET last_run = ? WHERE id = ?').run(now, id);

      await executeProject(project_id, (log) => {
        console.log(`[Scheduler:${name}] ${log.label}: ${log.status} (${log.duration}ms)`);
      });

      console.log(`[Scheduler] "${name}" completato`);
    } catch (err: any) {
      console.error(`[Scheduler] "${name}" errore: ${err.message}`);
    } finally {
      runningSchedules.delete(id);
      // Calculate next run
      const nextRun = getNextRun(cron_expr);
      if (nextRun) {
        db.prepare('UPDATE schedules SET next_run = ? WHERE id = ?').run(nextRun, id);
      }
    }
  }, {
    scheduled: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  activeJobs.set(id, { id, task });

  // Set next_run
  const nextRun = getNextRun(cron_expr);
  if (nextRun) {
    db.prepare('UPDATE schedules SET next_run = ? WHERE id = ?').run(nextRun, id);
  }

  console.log(`[Scheduler] Job avviato: "${name}" (${cron_expr})${nextRun ? ` → prossima: ${nextRun}` : ''}`);
  return true;
}

/**
 * Stop a cron job for a specific schedule.
 */
export function stopScheduleJob(scheduleId: string): void {
  const job = activeJobs.get(scheduleId);
  if (job) {
    job.task.stop();
    activeJobs.delete(scheduleId);
  }
}

/**
 * Reload a schedule (stop + start if enabled, just stop if disabled).
 */
export function reloadScheduleJob(scheduleId: string): void {
  const schedule: any = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId);
  if (!schedule) {
    stopScheduleJob(scheduleId);
    return;
  }
  if (schedule.enabled && schedule.trigger_type !== 'manual' && schedule.cron_expr) {
    startScheduleJob(schedule);
  } else {
    stopScheduleJob(scheduleId);
  }
}

/**
 * Stop all active cron jobs (for graceful shutdown).
 */
export function stopAllScheduleJobs(): void {
  for (const [id, job] of activeJobs) {
    job.task.stop();
    activeJobs.delete(id);
  }
  console.log('[Scheduler] Tutti i job fermati');
}

/**
 * Get status of all active jobs.
 */
export function getActiveJobsStatus(): { id: string; running: boolean }[] {
  return Array.from(activeJobs.keys()).map(id => ({
    id,
    running: runningSchedules.has(id),
  }));
}

// ─── Helpers ────────────────────────────────────────────────────

function getNextRun(cronExpr: string): string | null {
  try {
    // node-cron doesn't expose next run directly, compute manually
    const interval = cron.validate(cronExpr) ? parseCronToMs(cronExpr) : null;
    if (interval) {
      return new Date(Date.now() + interval).toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

function parseCronToMs(cronExpr: string): number | null {
  // Simple heuristic for common patterns
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length < 5) return null;

  // Every minute: * * * * *
  if (parts.every(p => p === '*')) return 60 * 1000;

  // Every N minutes: */N * * * *
  const minMatch = parts[0].match(/^\*\/(\d+)$/);
  if (minMatch) return parseInt(minMatch[1], 10) * 60 * 1000;

  // Specific minute each hour: N * * * *
  if (/^\d+$/.test(parts[0]) && parts[1] === '*') return 60 * 60 * 1000;

  // Specific time daily: N N * * *
  if (/^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]) && parts[2] === '*') return 24 * 60 * 60 * 1000;

  // Default: 1 hour
  return 60 * 60 * 1000;
}
