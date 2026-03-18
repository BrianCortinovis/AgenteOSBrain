"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrompts = getPrompts;
exports.getPromptById = getPromptById;
exports.createPrompt = createPrompt;
exports.updatePrompt = updatePrompt;
exports.deletePrompt = deletePrompt;
const connection_1 = __importDefault(require("../../database/connection"));
const id_1 = require("../../utils/id");
function getPrompts(scope, scopeId) {
    if (scope && scopeId) {
        return connection_1.default.prepare('SELECT * FROM prompts WHERE scope = ? AND scope_id = ? ORDER BY created_at').all(scope, scopeId);
    }
    if (scope) {
        return connection_1.default.prepare('SELECT * FROM prompts WHERE scope = ? ORDER BY created_at').all(scope);
    }
    return connection_1.default.prepare('SELECT * FROM prompts ORDER BY scope, created_at').all();
}
function getPromptById(id) {
    return connection_1.default.prepare('SELECT * FROM prompts WHERE id = ?').get(id);
}
function createPrompt(data) {
    const id = (0, id_1.generateId)();
    const now = new Date().toISOString();
    connection_1.default.prepare('INSERT INTO prompts (id, scope, scope_id, name, content, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, data.scope || 'global', data.scope_id || '', data.name || 'Nuovo Prompt', data.content || '', data.category || 'generale', now, now);
    return getPromptById(id);
}
function updatePrompt(id, data) {
    const fields = [];
    const values = [];
    const allowed = ['name', 'content', 'category', 'scope', 'scope_id'];
    for (const key of allowed) {
        if (data[key] !== undefined) {
            fields.push(`${key} = ?`);
            values.push(data[key]);
        }
    }
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    connection_1.default.prepare(`UPDATE prompts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return getPromptById(id);
}
function deletePrompt(id) {
    connection_1.default.prepare('DELETE FROM prompts WHERE id = ?').run(id);
}
