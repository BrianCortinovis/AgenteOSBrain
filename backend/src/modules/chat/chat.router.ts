import { Router } from 'express';
import * as service from './chat.service';
import { config } from '../../config';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = Router();

router.get('/projects/:id/chat', (req, res) => {
  res.json(service.getChatHistory(req.params.id));
});

router.post('/projects/:id/chat', async (req, res) => {
  const { message, provider_id, model_id } = req.body;
  if (!message) return res.status(400).json({ error: 'Messaggio richiesto' });
  try {
    const response = await service.sendChatMessage(req.params.id, message, provider_id, model_id);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/projects/:id/chat', (req, res) => {
  service.clearChatHistory(req.params.id);
  res.status(204).send();
});

// ─── Voice: Speech-to-Text (transcribe audio) ──────────────────
router.post('/voice/transcribe', async (req, res) => {
  try {
    const { audio_base64, language, stt_provider } = req.body;
    if (!audio_base64) return res.status(400).json({ error: 'audio_base64 richiesto' });

    const provider = stt_provider || 'openai';

    if (provider === 'browser') {
      // Browser Web Speech API handles this client-side, this shouldn't be called
      return res.json({ text: '', provider: 'browser' });
    }

    // OpenAI Whisper
    if (!config.openaiApiKey) {
      return res.status(400).json({ error: 'OPENAI_API_KEY richiesta per trascrizione server-side' });
    }

    // Decode base64 audio to temp file
    const audioBuffer = Buffer.from(audio_base64, 'base64');
    const tmpFile = path.join(os.tmpdir(), `voice_${Date.now()}.webm`);
    fs.writeFileSync(tmpFile, audioBuffer);

    const blob = new Blob([audioBuffer]);
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');
    formData.append('model', 'whisper-1');
    if (language) formData.append('language', language);
    formData.append('response_format', 'json');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.openaiApiKey}` },
      body: formData,
    });

    // Cleanup
    try { fs.unlinkSync(tmpFile); } catch {}

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      throw new Error(`Whisper error: ${whisperRes.status} ${errText}`);
    }

    const data: any = await whisperRes.json();
    res.json({ text: data.text, provider: 'openai_whisper' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Voice: Text-to-Speech (generate audio from text) ──────────
router.post('/voice/speak', async (req, res) => {
  try {
    const { text, voice, speed, tts_provider } = req.body;
    if (!text) return res.status(400).json({ error: 'text richiesto' });

    const provider = tts_provider || 'openai';

    if (provider === 'browser') {
      // Browser Web Speech Synthesis handles this client-side
      return res.json({ provider: 'browser' });
    }

    // OpenAI TTS
    if (!config.openaiApiKey) {
      return res.status(400).json({ error: 'OPENAI_API_KEY richiesta per TTS server-side' });
    }

    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text.slice(0, 4096),
        voice: voice || 'alloy',
        speed: speed || 1.0,
        response_format: 'mp3',
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      throw new Error(`TTS error: ${ttsRes.status} ${errText}`);
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
    const b64 = audioBuffer.toString('base64');
    res.json({
      audio_base64: b64,
      content_type: 'audio/mpeg',
      provider: 'openai_tts',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Voice: Available providers ────────────────────────────────
router.get('/voice/providers', (_req, res) => {
  const sttProviders = [
    { id: 'browser', name: 'Browser (Web Speech API)', type: 'free', available: true, description: 'Trascrizione gratuita nel browser (Chrome/Edge)' },
    { id: 'openai', name: 'OpenAI Whisper', type: 'paid', available: !!config.openaiApiKey, description: 'Trascrizione ad alta qualità (richiede API key)' },
  ];
  const ttsProviders = [
    { id: 'browser', name: 'Browser (Speech Synthesis)', type: 'free', available: true, description: 'Sintesi vocale gratuita nel browser' },
    { id: 'openai', name: 'OpenAI TTS', type: 'paid', available: !!config.openaiApiKey, description: 'Voci realistiche (alloy, echo, fable, onyx, nova, shimmer)' },
  ];
  res.json({ stt: sttProviders, tts: ttsProviders });
});

export default router;
