"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const service = __importStar(require("./scheduler.service"));
const router = (0, express_1.Router)();
router.get('/projects/:id/schedules', (req, res) => {
    res.json(service.getSchedulesByProject(req.params.id));
});
router.post('/projects/:id/schedules', (req, res) => {
    res.status(201).json(service.createSchedule(req.params.id, req.body));
});
router.put('/schedules/:id', (req, res) => {
    const schedule = service.updateSchedule(req.params.id, req.body);
    if (!schedule)
        return res.status(404).json({ error: 'Automazione non trovata' });
    res.json(schedule);
});
router.delete('/schedules/:id', (req, res) => {
    service.deleteSchedule(req.params.id);
    res.status(204).send();
});
router.post('/schedules/:id/trigger', (req, res) => {
    const schedule = service.triggerSchedule(req.params.id);
    if (!schedule)
        return res.status(404).json({ error: 'Automazione non trovata' });
    res.json(schedule);
});
exports.default = router;
