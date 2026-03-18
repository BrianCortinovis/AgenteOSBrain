"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const connection_1 = __importDefault(require("./connection"));
function runMigrations() {
    connection_1.default.exec(`CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now'))
  )`);
    const migrationsDir = path_1.default.resolve(__dirname, 'migrations');
    if (!fs_1.default.existsSync(migrationsDir))
        return;
    const files = fs_1.default.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
    const applied = new Set(connection_1.default.prepare('SELECT name FROM migrations').all().map((r) => r.name));
    for (const file of files) {
        if (applied.has(file))
            continue;
        const sql = fs_1.default.readFileSync(path_1.default.join(migrationsDir, file), 'utf-8');
        connection_1.default.exec(sql);
        connection_1.default.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
        console.log(`[DB] Migration applied: ${file}`);
    }
}
