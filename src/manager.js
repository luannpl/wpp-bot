import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import P from 'pino';

const sessions = new Map();
const qrcodes = new Map();
const sessionConfigs = new Map();


export async function startSession(sessionId) {
  if (sessions.has(sessionId)) {
    console.log(`Sessão ${sessionId} já está ativa`);
    return;
  }
  const sessionPath = path.resolve(`./sessions/${sessionId}`);

if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
}

  sessionConfigs.set(sessionId, {
  sourceGroup: null,
  targetGroup: null,
  delayMs: 2 * 60 * 1000
});


  const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionId}`);

  const sock = makeWASocket({
    logger: P({ level: 'silent' }),
    auth: state
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
  const { connection, qr, lastDisconnect } = update;

  if (qr) {
    qrcode.generate(qr, { small: true });
    console.log(`QR Code gerado para ${sessionId}`);
    qrcodes.set(sessionId, qr);
  }

  if (connection === 'open') {
    console.log(`Sessão ${sessionId} conectada`);
    qrcodes.delete(sessionId);
  }

  if (connection === 'close') {
    const reason = lastDisconnect?.error?.output?.statusCode;

    console.log(`Sessão ${sessionId} desconectada. Motivo:`, reason);

    sessions.delete(sessionId);
    qrcodes.delete(sessionId);

    if (reason !== DisconnectReason.loggedOut) {
      console.log(`Reconectando sessão ${sessionId}...`);
      startSession(sessionId);
    }
  }
});


  sock.ev.on('messages.upsert', async ({ messages }) => {
  const msg = messages[0];
  if (!msg.message) return;

  const from = msg.key.remoteJid;
  console.log('Mensagem recebida de:', from);
  const isGroup = from.endsWith('@g.us');
  const isFromMe = msg.key.fromMe;

  const config = getSessionConfig(sessionId);
  if (!config || !config.sourceGroup || !config.targetGroup) return;

  if (!isGroup) return;
  if (!isFromMe) return;
  if (from !== config.sourceGroup) return;

  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text;

  if (!text) return;
  console.log(`[${sessionId}] mensagem de:`, msg.key.remoteJid);

  console.log(`[${sessionId}] mensagem capturada, aguardando delay...`);

  setTimeout(async () => {
    await sock.sendMessage(config.targetGroup, { text });
    console.log(`[${sessionId}] mensagem encaminhada`);
  }, config.delayMs);
});

  sessions.set(sessionId, sock);
}

export function stopSession(sessionId) {
  const sock = sessions.get(sessionId);
  if (!sock) return;

  sock.end();
  sessions.delete(sessionId);
  console.log(`Sessão ${sessionId} encerrada`);
}

export function listSessions() {
  return [...sessions.keys()];
}

export function getQRCode(sessionId) {
  return qrcodes.get(sessionId) || null;
}

export function updateSessionConfig(sessionId, config) {
  const current = sessionConfigs.get(sessionId);
  if (!current) return;

  sessionConfigs.set(sessionId, {
    ...current,
    ...config
  });
}

export function getSessionConfig(sessionId) {
  return sessionConfigs.get(sessionId);
}