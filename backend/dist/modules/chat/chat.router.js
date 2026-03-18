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
const service = __importStar(require("./chat.service"));
const router = (0, express_1.Router)();
router.get('/projects/:id/chat', (req, res) => {
    res.json(service.getChatHistory(req.params.id));
});
router.post('/projects/:id/chat', async (req, res) => {
    const { message, provider_id, model_id } = req.body;
    if (!message)
        return res.status(400).json({ error: 'Messaggio richiesto' });
    try {
        const response = await service.sendChatMessage(req.params.id, message, provider_id, model_id);
        res.json(response);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.delete('/projects/:id/chat', (req, res) => {
    service.clearChatHistory(req.params.id);
    res.status(204).send();
});
exports.default = router;
