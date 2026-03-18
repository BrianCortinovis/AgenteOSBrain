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
const service = __importStar(require("./connectors.service"));
const router = (0, express_1.Router)();
// ─── Definizioni (catalogo) ────────────────────────────────────
router.get('/definitions', (_req, res) => {
    res.json(service.getAllDefinitions());
});
// ─── Istanze legacy per progetto ───────────────────────────────
router.get('/projects/:id/connectors', (req, res) => {
    res.json(service.getInstancesByProject(req.params.id));
});
router.post('/projects/:id/connectors', (req, res) => {
    res.status(201).json(service.createInstance(req.params.id, req.body));
});
router.put('/connectors/:id', (req, res) => {
    const instance = service.updateInstance(req.params.id, req.body);
    if (!instance)
        return res.status(404).json({ error: 'Connettore non trovato' });
    res.json(instance);
});
router.delete('/connectors/:id', (req, res) => {
    service.deleteInstance(req.params.id);
    res.status(204).send();
});
// ─── Istanze configurate (globali v2) ──────────────────────────
// Lista tutte le istanze configurate
router.get('/connectors/instances', (_req, res) => {
    res.json(service.getAllConfiguredInstances());
});
// Crea una nuova istanza configurata
router.post('/connectors/instances', (req, res) => {
    try {
        const instance = service.createConfiguredInstance(req.body);
        res.status(201).json(instance);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// Aggiorna un'istanza configurata
router.put('/connectors/instances/:id', (req, res) => {
    const instance = service.updateConfiguredInstance(req.params.id, req.body);
    if (!instance)
        return res.status(404).json({ error: 'Istanza connettore non trovata' });
    res.json(instance);
});
// Elimina un'istanza configurata
router.delete('/connectors/instances/:id', (req, res) => {
    service.deleteConfiguredInstance(req.params.id);
    res.status(204).send();
});
// Testa la connessione di un'istanza configurata
router.post('/connectors/instances/:id/test', async (req, res) => {
    try {
        const instance = service.getConfiguredInstance(req.params.id);
        if (!instance)
            return res.status(404).json({ error: 'Istanza connettore non trovata' });
        const config = JSON.parse(instance.config || '{}');
        const result = await service.testConnection(instance.connector_id, config);
        const now = new Date().toISOString();
        // Aggiorna lo stato dell'istanza
        service.updateConfiguredInstance(req.params.id, {
            status: result.success ? 'connected' : 'error',
            last_tested: now,
        });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// Testa una connessione senza salvare (per anteprima prima di salvare)
router.post('/connectors/test', async (req, res) => {
    try {
        const { connector_id, config } = req.body;
        if (!connector_id)
            return res.status(400).json({ error: 'connector_id richiesto' });
        const result = await service.testConnection(connector_id, config || {});
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
exports.default = router;
