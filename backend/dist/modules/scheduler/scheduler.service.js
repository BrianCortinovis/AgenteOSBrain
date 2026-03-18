"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSchedulesByProject = getSchedulesByProject;
exports.getScheduleById = getScheduleById;
exports.createSchedule = createSchedule;
exports.updateSchedule = updateSchedule;
exports.deleteSchedule = deleteSchedule;
exports.triggerSchedule = triggerSchedule;
const connection_1 = __importDefault(require("../../database/connection"));
const id_1 = require("../../utils/id");
function getSchedulesByProject(projectId) {
    return connection_1.default.prepare('SELECT * FROM schedules WHERE project_id = ? ORDER BY created_at').all(projectId);
}
function getScheduleById(id) {
    return connection_1.default.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
}
function createSchedule(projectId, data) {
    const id = (0, id_1.generateId)();
    connection_1.default.prepare('INSERT INTO schedules (id, project_id, node_id, name, trigger_type, cron_expr, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, projectId, data.node_id || '', data.name || 'Nuova Automazione', data.trigger_type || 'manual', data.cron_expr || '', data.enabled !== false ? 1 : 0);
    return getScheduleById(id);
}
function updateSchedule(id, data) {
    const fields = [];
    const values = [];
    const allowed = ['name', 'node_id', 'trigger_type', 'cron_expr'];
    for (const key of allowed) {
        if (data[key] !== undefined) {
            fields.push(`${key} = ?`);
            values.push(data[key]);
        }
    }
    if (data.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(data.enabled ? 1 : 0);
    }
    if (data.last_run !== undefined) {
        fields.push('last_run = ?');
        values.push(data.last_run);
    }
    if (data.next_run !== undefined) {
        fields.push('next_run = ?');
        values.push(data.next_run);
    }
    if (fields.length === 0)
        return getScheduleById(id);
    values.push(id);
    connection_1.default.prepare(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return getScheduleById(id);
}
function deleteSchedule(id) {
    connection_1.default.prepare('DELETE FROM schedules WHERE id = ?').run(id);
}
function triggerSchedule(id) {
    const now = new Date().toISOString();
    connection_1.default.prepare('UPDATE schedules SET last_run = ? WHERE id = ?').run(now, id);
    return getScheduleById(id);
}
