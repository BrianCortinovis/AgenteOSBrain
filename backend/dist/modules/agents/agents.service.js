"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentsByProject = getAgentsByProject;
exports.getAgentById = getAgentById;
exports.createAgent = createAgent;
exports.updateAgent = updateAgent;
exports.deleteAgent = deleteAgent;
const connection_1 = __importDefault(require("../../database/connection"));
const id_1 = require("../../utils/id");
function getAgentsByProject(projectId) {
    return connection_1.default.prepare('SELECT * FROM agents WHERE project_id = ? ORDER BY created_at').all(projectId);
}
function getAgentById(id) {
    return connection_1.default.prepare('SELECT * FROM agents WHERE id = ?').get(id);
}
function createAgent(projectId, data) {
    const id = (0, id_1.generateId)();
    connection_1.default.prepare(`INSERT INTO agents (id, project_id, name, role, provider_id, model_id, system_prompt, temperature, tools, memory_enabled, fallback_provider_id, fallback_model_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, projectId, data.name || 'Nuovo Agente', data.role || '', data.provider_id || 'openai', data.model_id || 'gpt-4o', data.system_prompt || '', data.temperature ?? 0.7, JSON.stringify(data.tools || []), data.memory_enabled ? 1 : 0, data.fallback_provider_id || '', data.fallback_model_id || '');
    return getAgentById(id);
}
function updateAgent(id, data) {
    const fields = [];
    const values = [];
    const allowed = ['name', 'role', 'provider_id', 'model_id', 'system_prompt', 'temperature', 'memory_enabled', 'fallback_provider_id', 'fallback_model_id'];
    for (const key of allowed) {
        if (data[key] !== undefined) {
            if (key === 'memory_enabled') {
                fields.push(`${key} = ?`);
                values.push(data[key] ? 1 : 0);
            }
            else {
                fields.push(`${key} = ?`);
                values.push(data[key]);
            }
        }
    }
    if (data.tools !== undefined) {
        fields.push('tools = ?');
        values.push(JSON.stringify(data.tools));
    }
    if (fields.length === 0)
        return getAgentById(id);
    values.push(id);
    connection_1.default.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return getAgentById(id);
}
function deleteAgent(id) {
    connection_1.default.prepare('UPDATE nodes SET agent_id = NULL WHERE agent_id = ?').run(id);
    connection_1.default.prepare('DELETE FROM agents WHERE id = ?').run(id);
}
