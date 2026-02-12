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

  // Preserva configurações existentes ou cria novas com valores padrão
  const existingConfig = sessionConfigs.get(sessionId);
  
  if (existingConfig) {
    // Se já existe config, preserva tudo e reseta apenas os IDs dos grupos
    console.log(`🔄 [${sessionId}] Reiniciando sessão - preservando configurações existentes`);
    sessionConfigs.set(sessionId, {
      ...existingConfig,
      sourceGroup: null,
      targetGroup: null,
      sourceGroupName: null,
      targetGroupName: null
    });
  } else {
    // Primeira vez, cria configuração padrão
    console.log(`🆕 [${sessionId}] Criando configuração inicial`);
    sessionConfigs.set(sessionId, {
      sourceGroup: null,
      targetGroup: null,
      sourceGroupName: null,
      targetGroupName: null,
      sourceGroupPrefix: null,
      targetGroupPrefix: null,
      delayMs: 2 * 60 * 1000
    });
  }


  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

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

  const config = sessionConfigs.get(sessionId);
  if (config?.sourceGroupPrefix && config?.targetGroupPrefix) {
    console.log(`\n🔍 [${sessionId}] Buscando grupos com prefixos:`);
    console.log(`   📤 Origem: "${config.sourceGroupPrefix}"`);
    console.log(`   📥 Destino: "${config.targetGroupPrefix}"\n`);
    resolveGroupsByPrefix(sock, sessionId);
  } else {
    console.log(`\n⚠️  [${sessionId}] Prefixos de grupo não configurados. Use /sessions/:id/config para configurar.\n`);
  }
}


  if (connection === 'close') {
    const reason = lastDisconnect?.error?.output?.statusCode;
    
    console.log(`\n❌ [${sessionId}] Desconectado. Código: ${reason}`);

    // Limpa referências em memória
    const oldSock = sessions.get(sessionId);
    if (oldSock) {
      try {
        oldSock.end();
      } catch {}
    }
    sessions.delete(sessionId);
    qrcodes.delete(sessionId);

    // Tratamento específico para LOGGED OUT (401)
    if (reason === DisconnectReason.loggedOut) {
      console.log(`⚠️ [${sessionId}] Sessão inválida ou desconectada pelo celular.`);
      console.log(`🗑️ [${sessionId}] Apagando arquivos da sessão para gerar novo QR Code...`);
      
      const sessionDir = path.resolve(`./sessions/${sessionId}`);
      
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log(`✅ [${sessionId}] Pasta da sessão limpa.`);
      } catch (err) {
        console.error(`❌Erro ao limpar pasta da sessão: ${err.message}`);
      }

      // Reinicia imediatamente para gerar novo QR Code
      console.log(`🔄 [${sessionId}] Iniciando nova sessão limpa...`);
      setTimeout(() => startSession(sessionId), 1000);
      
    } else {
      // Para outros erros (ex: internet caiu), tenta reconectar
      console.log(`🔄 [${sessionId}] Tentando reconectar em 2s...`);
      setTimeout(() => startSession(sessionId), 2000);
    }
  }
});


  sock.ev.on('messages.upsert', async ({ messages }) => {
  const msg = messages[0];
  if (!msg.message) return;

  const from = msg.key.remoteJid;
  const isGroup = from.endsWith('@g.us');
  const isFromMe = msg.key.fromMe;

  const config = getSessionConfig(sessionId);
  if (!config || !config.sourceGroup || !config.targetGroup) {
    console.log(`[${sessionId}] ⚠️  Configuração incompleta - grupos não configurados`);
    return;
  }

  if (!isGroup) return;
  if (!isFromMe) return;
  if (from !== config.sourceGroup) return;

  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text;

  if (!text) return;

  // Log detalhado da mensagem recebida
  console.log('\n' + '='.repeat(60));
  console.log(`📨 [${sessionId}] MENSAGEM RECEBIDA`);
  console.log('='.repeat(60));
  console.log(`📍 Grupo de Origem: ${config.sourceGroupName || 'Nome não disponível'}`);
  console.log(`🆔 ID do Grupo: ${from}`);
  console.log(`💬 Mensagem: "${text}"`);
  console.log('='.repeat(60) + '\n');

  console.log(`[${sessionId}] ⏳ Aguardando ${config.delayMs / 1000}s antes de encaminhar...`);

  setTimeout(async () => {
  try {
    console.log(`[${sessionId}] ⌨️  Simulando digitação no grupo destino...`);

    await simulateTyping(sock, config.targetGroup, 2000 + Math.random() * 2000);

    await sock.sendMessage(config.targetGroup, { text });

    // Log detalhado do envio
    console.log('\n' + '='.repeat(60));
    console.log(`✅ [${sessionId}] MENSAGEM ENVIADA`);
    console.log('='.repeat(60));
    console.log(`📍 Grupo de Destino: ${config.targetGroupName || 'Nome não disponível'}`);
    console.log(`🆔 ID do Grupo: ${config.targetGroup}`);
    console.log(`💬 Mensagem: "${text}"`);
    console.log('='.repeat(60) + '\n');
  } catch (err) {
    console.error('\n' + '='.repeat(60));
    console.error(`❌ [${sessionId}] ERRO AO ENVIAR MENSAGEM`);
    console.error('='.repeat(60));
    console.error('Erro:', err);
    console.error('='.repeat(60) + '\n');
  }
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
  
  if (!current) {
    // Se a sessão ainda não existe, cria uma nova configuração
    console.log(`📝 [${sessionId}] Criando configuração antes da sessão iniciar`);
    sessionConfigs.set(sessionId, {
      sourceGroup: null,
      targetGroup: null,
      sourceGroupName: null,
      targetGroupName: null,
      sourceGroupPrefix: null,
      targetGroupPrefix: null,
      delayMs: 2 * 60 * 1000,
      ...config  // Aplica as configurações fornecidas
    });
  } else {
    // Se já existe, atualiza
    sessionConfigs.set(sessionId, {
      ...current,
      ...config
    });
  }
}

export function getSessionConfig(sessionId) {
  return sessionConfigs.get(sessionId);
}

async function simulateTyping(sock, jid, durationMs = 3000) {
  await sock.presenceSubscribe(jid);
  await sock.sendPresenceUpdate('composing', jid);

  await new Promise(resolve => setTimeout(resolve, durationMs));

  await sock.sendPresenceUpdate('paused', jid);
}


async function resolveGroupsByPrefix(sock, sessionId) {
  const config = sessionConfigs.get(sessionId);
  if (!config) return;

  const chats = await sock.groupFetchAllParticipating();

  const groups = Object.values(chats);

  const source = groups.find(g =>
    g.subject?.toLowerCase().startsWith(config.sourceGroupPrefix.toLowerCase())
  );

  const target = groups.find(g =>
    g.subject?.toLowerCase().startsWith(config.targetGroupPrefix.toLowerCase())
  );

  if (!source || !target) {
    console.log('\n' + '='.repeat(60));
    console.log(`❌ [${sessionId}] GRUPOS NÃO ENCONTRADOS`);
    console.log('='.repeat(60));
    console.log(`Procurando por:`);
    console.log(`   📤 Origem: prefixo "${config.sourceGroupPrefix}" ${!source ? '❌ NÃO ENCONTRADO' : '✅'}`);
    console.log(`   📥 Destino: prefixo "${config.targetGroupPrefix}" ${!target ? '❌ NÃO ENCONTRADO' : '✅'}`);
    console.log(`\nGrupos disponíveis (${groups.length}):`);
    groups.forEach((g, idx) => {
      console.log(`   ${idx + 1}. "${g.subject}" (ID: ${g.id})`);
    });
    console.log('='.repeat(60) + '\n');
    return;
  }

  sessionConfigs.set(sessionId, {
    ...config,
    sourceGroup: source.id,
    targetGroup: target.id,
    sourceGroupName: source.subject,
    targetGroupName: target.subject
  });

  console.log('\n' + '='.repeat(60));
  console.log(`✅ [${sessionId}] GRUPOS CONFIGURADOS COM SUCESSO`);
  console.log('='.repeat(60));
  console.log(`📤 Grupo de Origem: ${source.subject}`);
  console.log(`   ID: ${source.id}`);
  console.log(`📥 Grupo de Destino: ${target.subject}`);
  console.log(`   ID: ${target.id}`);
  console.log('='.repeat(60) + '\n');
}
