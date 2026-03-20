import express from 'express';
import {
  startSession,
  stopSession,
  listSessions,
  getQRCode,
  updateSessionConfig
} from './manager.js';
import { makeSessionController } from './modules/session/session.module.js';

const router = express.Router();
const sessionController = makeSessionController();

router.post('/sessions', async (req, res) => {
  const {
    sessionId,
    sourceGroupPrefix,
    targetGroupPrefix
  } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId obrigatório' });
  }

  // Configura os prefixos ANTES de iniciar a sessão
  if (sourceGroupPrefix && targetGroupPrefix) {
    updateSessionConfig(sessionId, {
      sourceGroupPrefix,
      targetGroupPrefix
    });
    console.log(`✅ Prefixos configurados para ${sessionId}:`);
    console.log(`   📤 Origem: "${sourceGroupPrefix}"`);
    console.log(`   📥 Destino: "${targetGroupPrefix}"`);
  }
  
  await startSession(sessionId);
  return sessionController.createSession(req, res)
});

router.delete('/sessions/:id', (req, res) => {
  stopSession(req.params.id);
  res.json({ ok: true });
});

router.get('/sessions', sessionController.listSessions);

router.get('/sessions/:id/qrcode', (req, res) => {
  const qr = getQRCode(req.params.id);

  if (!qr) {
    return res.status(404).json({
      error: 'QR Code não disponível ou sessão não existe'
    });
  }

  res.json({ qr });
});

router.post('/sessions/:id/config', (req, res) => {
  const { sourceGroup, targetGroup, delayMs } = req.body;

  updateSessionConfig(req.params.id, {
    sourceGroup,
    targetGroup,
    delayMs
  });

  res.json({ ok: true });
});


export default router;
