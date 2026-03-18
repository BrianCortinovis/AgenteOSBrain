"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOutputsByProject = getOutputsByProject;
exports.getOutputById = getOutputById;
exports.createOutput = createOutput;
exports.deleteOutput = deleteOutput;
const connection_1 = __importDefault(require("../../database/connection"));
const id_1 = require("../../utils/id");
function getOutputsByProject(projectId) {
    return connection_1.default.prepare('SELECT * FROM outputs WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
}
function getOutputById(id) {
    return connection_1.default.prepare('SELECT * FROM outputs WHERE id = ?').get(id);
}
function createOutput(projectId, data) {
    const id = (0, id_1.generateId)();
    connection_1.default.prepare('INSERT INTO outputs (id, project_id, node_id, type, title, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, projectId, data.node_id || '', data.type || 'log', data.title || '', data.content || '', JSON.stringify(data.metadata || {}));
    return getOutputById(id);
}
function deleteOutput(id) {
    connection_1.default.prepare('DELETE FROM outputs WHERE id = ?').run(id);
}
