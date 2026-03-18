"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGraph = getGraph;
exports.saveGraph = saveGraph;
exports.createNode = createNode;
exports.updateNode = updateNode;
exports.deleteNode = deleteNode;
exports.createEdge = createEdge;
exports.deleteEdge = deleteEdge;
const connection_1 = __importDefault(require("../../database/connection"));
const id_1 = require("../../utils/id");
function getGraph(projectId) {
    const nodes = connection_1.default.prepare('SELECT * FROM nodes WHERE project_id = ?').all(projectId);
    const edges = connection_1.default.prepare('SELECT * FROM edges WHERE project_id = ?').all(projectId);
    return { nodes, edges };
}
function saveGraph(projectId, data) {
    const transaction = connection_1.default.transaction(() => {
        connection_1.default.prepare('DELETE FROM edges WHERE project_id = ?').run(projectId);
        connection_1.default.prepare('DELETE FROM nodes WHERE project_id = ?').run(projectId);
        for (const node of data.nodes) {
            connection_1.default.prepare(`INSERT INTO nodes (id, project_id, type, label, description, state, color, config, position_x, position_y, width, height, agent_id, provider_id, model_id, system_prompt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(node.id, projectId, node.type || 'sorgente', node.label || 'Nuovo Nodo', node.description || '', node.state || 'bozza', node.color || '', JSON.stringify(node.config || {}), node.position_x || 0, node.position_y || 0, node.width || 200, node.height || 80, node.agent_id || null, node.provider_id || '', node.model_id || '', node.system_prompt || '');
        }
        for (const edge of data.edges) {
            connection_1.default.prepare('INSERT INTO edges (id, project_id, source_id, target_id, label, condition) VALUES (?, ?, ?, ?, ?, ?)').run(edge.id, projectId, edge.source_id, edge.target_id, edge.label || '', edge.condition || '');
        }
        connection_1.default.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), projectId);
    });
    transaction();
    return getGraph(projectId);
}
function createNode(projectId, data) {
    const id = data.id || (0, id_1.generateId)();
    connection_1.default.prepare(`INSERT INTO nodes (id, project_id, type, label, description, state, color, config, position_x, position_y, width, height, agent_id, provider_id, model_id, system_prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, projectId, data.type || 'sorgente', data.label || 'Nuovo Nodo', data.description || '', data.state || 'bozza', data.color || '', typeof data.config === 'string' ? data.config : JSON.stringify(data.config || {}), data.position_x || 0, data.position_y || 0, data.width || 200, data.height || 80, data.agent_id || null, data.provider_id || '', data.model_id || '', data.system_prompt || '');
    return connection_1.default.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
}
function updateNode(id, data) {
    const fields = [];
    const values = [];
    const allowed = ['type', 'label', 'description', 'state', 'color', 'position_x', 'position_y', 'width', 'height', 'agent_id', 'provider_id', 'model_id', 'system_prompt'];
    for (const key of allowed) {
        if (data[key] !== undefined) {
            fields.push(`${key} = ?`);
            values.push(data[key]);
        }
    }
    if (data.config !== undefined) {
        const configVal = typeof data.config === 'string' ? data.config : JSON.stringify(data.config);
        fields.push('config = ?');
        values.push(configVal);
    }
    if (fields.length === 0)
        return connection_1.default.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
    values.push(id);
    connection_1.default.prepare(`UPDATE nodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return connection_1.default.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
}
function deleteNode(id) {
    connection_1.default.prepare('DELETE FROM nodes WHERE id = ?').run(id);
}
function createEdge(projectId, data) {
    const id = data.id || (0, id_1.generateId)();
    connection_1.default.prepare('INSERT INTO edges (id, project_id, source_id, target_id, label, condition) VALUES (?, ?, ?, ?, ?, ?)').run(id, projectId, data.source_id, data.target_id, data.label || '', data.condition || '');
    return connection_1.default.prepare('SELECT * FROM edges WHERE id = ?').get(id);
}
function deleteEdge(id) {
    connection_1.default.prepare('DELETE FROM edges WHERE id = ?').run(id);
}
