"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllProjects = getAllProjects;
exports.getProjectById = getProjectById;
exports.createProject = createProject;
exports.updateProject = updateProject;
exports.deleteProject = deleteProject;
exports.duplicateProject = duplicateProject;
const connection_1 = __importDefault(require("../../database/connection"));
const id_1 = require("../../utils/id");
function getAllProjects() {
    return connection_1.default.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
}
function getProjectById(id) {
    return connection_1.default.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}
function createProject(data) {
    const id = (0, id_1.generateId)();
    const now = new Date().toISOString();
    connection_1.default.prepare('INSERT INTO projects (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, data.name, data.description || '', 'bozza', now, now);
    return getProjectById(id);
}
function updateProject(id, data) {
    const fields = [];
    const values = [];
    if (data.name !== undefined) {
        fields.push('name = ?');
        values.push(data.name);
    }
    if (data.description !== undefined) {
        fields.push('description = ?');
        values.push(data.description);
    }
    if (data.status !== undefined) {
        fields.push('status = ?');
        values.push(data.status);
    }
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    connection_1.default.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return getProjectById(id);
}
function deleteProject(id) {
    connection_1.default.prepare('DELETE FROM projects WHERE id = ?').run(id);
}
function duplicateProject(id) {
    const original = getProjectById(id);
    if (!original)
        return null;
    const newProject = createProject({ name: `${original.name} (copia)`, description: original.description });
    if (!newProject)
        return null;
    const newId = newProject.id;
    const nodes = connection_1.default.prepare('SELECT * FROM nodes WHERE project_id = ?').all(id);
    const nodeIdMap = {};
    for (const node of nodes) {
        const newNodeId = (0, id_1.generateId)();
        nodeIdMap[node.id] = newNodeId;
        connection_1.default.prepare('INSERT INTO nodes (id, project_id, type, label, description, state, color, config, position_x, position_y, width, height, agent_id, provider_id, model_id, system_prompt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(newNodeId, newId, node.type, node.label, node.description, 'bozza', node.color, node.config, node.position_x, node.position_y, node.width, node.height, null, node.provider_id, node.model_id, node.system_prompt);
    }
    const edges = connection_1.default.prepare('SELECT * FROM edges WHERE project_id = ?').all(id);
    for (const edge of edges) {
        const newSource = nodeIdMap[edge.source_id];
        const newTarget = nodeIdMap[edge.target_id];
        if (newSource && newTarget) {
            connection_1.default.prepare('INSERT INTO edges (id, project_id, source_id, target_id, label, condition) VALUES (?, ?, ?, ?, ?, ?)').run((0, id_1.generateId)(), newId, newSource, newTarget, edge.label, edge.condition);
        }
    }
    return getProjectById(newId);
}
