#!/usr/bin/env node
'use strict';

// Local-only loot queue for two Tampermonkey profiles on the same machine.
// No persistence: ground drops are short-lived; restarting clears stale work.

const crypto = require('crypto');
const http = require('http');

const port = Number(process.argv[2]) || 8787;
const jobs = new Map(); // group:map:dropId -> job
const clients = new Set();

function log(message) {
  const now = new Date();
  const timestamp = now.toLocaleTimeString('en-GB', { hour12: false });
  console.log(`[${timestamp}] ${message}`);
}

function textFrame(text) {
  const payload = Buffer.from(text);
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  if (payload.length > 0xffff) throw new Error('message is too large');
  const header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}

function send(client, message) {
  if (!client.socket.destroyed) client.socket.write(textFrame(JSON.stringify(message)));
}
function broadcast(group, message) {
  for (const client of clients) if (client.group === group) send(client, message);
}
function safeRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const dropId = Number(raw.dropId) >>> 0;
  const itemId = Number(raw.itemId) | 0;
  const map = String(raw.map || '').trim();
  const x = Number(raw.x), y = Number(raw.y);
  if (!dropId || !itemId || !map || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { dropId, itemId, itemName: String(raw.itemName || itemId), map, x, y };
}
function expireJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.expiresAt <= now) {
      jobs.delete(id);
      broadcast(job.group, { type: 'expired', id });
      log(`Expired ${id}`);
      continue;
    }
    if (job.state === 'claimed' && job.leaseUntil <= now) {
      job.state = 'open'; job.claimedBy = null; job.claimToken = null; job.leaseUntil = 0;
      broadcast(job.group, { type: 'available', job });
      log(`Lease expired; reopened ${id}`);
    }
  }
}
function handle(client, message) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'hello') {
    client.group = String(message.group || 'default').trim().slice(0, 48) || 'default';
    client.clientId = String(message.clientId || 'anonymous').trim().slice(0, 80);
    client.role = message.role === 'collector' ? 'collector' : 'farm';
    send(client, { type: 'welcome', service: 'loot-queue', group: client.group });
    const open = [...jobs.values()].filter(job => job.group === client.group && job.state === 'open');
    if (open.length) send(client, { type: 'available', jobs: open });
    return;
  }
  if (!client.group) return send(client, { type: 'error', reason: 'send hello first' });
  if (message.type === 'offer') {
    const record = safeRecord(message.record);
    if (!record) return send(client, { type: 'error', reason: 'invalid offer' });
    const id = `${client.group}:${record.map}:${record.dropId}`;
    if (jobs.has(id)) return send(client, { type: 'offered', id, duplicate: true });
    const now = Date.now();
    const ttlMs = Math.max(5_000, Math.min(120_000, Number(message.ttlMs) || 45_000));
    const job = { ...record, id, group: client.group, state: 'open', createdAt: now, expiresAt: now + ttlMs, claimedBy: null, claimToken: null, leaseUntil: 0 };
    jobs.set(id, job); send(client, { type: 'offered', id }); broadcast(client.group, { type: 'available', job });
    log(`Offer ${id}: ${record.itemName} @ ${record.map} (${Math.round(record.x)},${Math.round(record.y)})`);
    return;
  }
  const job = jobs.get(String(message.id || ''));
  if (!job || job.group !== client.group) return send(client, { type: 'error', reason: 'job not found' });
  if (message.type === 'claim') {
    if (job.state !== 'open') return send(client, { type: 'unavailable', id: job.id });
    job.state = 'claimed'; job.claimedBy = client.clientId;
    job.claimToken = crypto.randomBytes(12).toString('hex'); job.leaseUntil = Date.now() + 20_000;
    send(client, { type: 'claimed', job, claimToken: job.claimToken });
    log(`Claim ${job.id} by ${client.clientId}`);
    return;
  }
  if (job.claimedBy !== client.clientId || job.claimToken !== message.claimToken) return send(client, { type: 'error', reason: 'claim mismatch' });
  if (message.type === 'renew') {
    job.leaseUntil = Date.now() + 20_000;
    return;
  }
  if (message.type === 'ack') {
    jobs.delete(job.id); broadcast(client.group, { type: 'completed', id: job.id, itemId: job.itemId, itemName: job.itemName });
    // Collector will hold for one second and may claim a nearby remaining drop.
    const open = [...jobs.values()].filter(next => next.group === client.group && next.state === 'open');
    if (open.length) broadcast(client.group, { type: 'available', jobs: open });
    log(`Complete ${job.id}`); return;
  }
  if (message.type === 'discard') {
    jobs.delete(job.id);
    broadcast(client.group, { type: 'discarded', id: job.id, itemId: job.itemId, itemName: job.itemName, reason: String(message.reason || '') });
    const open = [...jobs.values()].filter(next => next.group === client.group && next.state === 'open');
    if (open.length) broadcast(client.group, { type: 'available', jobs: open });
    log(`Discard ${job.id}: ${message.reason || 'no reason'}`); return;
  }
  if (message.type === 'nack') {
    job.state = 'open'; job.claimedBy = null; job.claimToken = null; job.leaseUntil = 0;
    broadcast(client.group, { type: 'available', job });
    log(`Released ${job.id}: ${message.reason || 'no reason'}`);
  }
}
function parseFrames(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);
  while (client.buffer.length >= 2) {
    const b0 = client.buffer[0], b1 = client.buffer[1], lenFlag = b1 & 127, masked = !!(b1 & 128);
    if ((b0 & 15) === 8) return client.socket.end();
    let offset = 2, length = lenFlag;
    if (lenFlag === 126) { if (client.buffer.length < 4) return; length = client.buffer.readUInt16BE(2); offset = 4; }
    if (!masked || client.buffer.length < offset + 4 + length) return;
    const key = client.buffer.subarray(offset, offset + 4); offset += 4;
    const payload = Buffer.from(client.buffer.subarray(offset, offset + length));
    for (let i = 0; i < payload.length; i++) payload[i] ^= key[i % 4];
    client.buffer = client.buffer.subarray(offset + length);
    try { handle(client, JSON.parse(payload.toString())); } catch (_) { send(client, { type: 'error', reason: 'invalid JSON' }); }
  }
}

const server = http.createServer((_, res) => {
  res.writeHead(426, { 'Content-Type': 'text/plain' });
  res.end('WebSocket upgrade required\n');
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();

  const accept = crypto.createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '',
    '',
  ].join('\r\n'));

  const client = { socket, buffer: Buffer.alloc(0), group: null, clientId: null, role: null };
  clients.add(client);
  // Keep ASSIST.testLocalWs() useful as a quick browser-to-localhost diagnostic.
  send(client, { type: 'hello', service: 'loot-queue', connections: clients.size });
  socket.on('data', chunk => parseFrames(client, chunk));
  socket.on('close', () => {
    clients.delete(client);
    log(`Client disconnected${client.clientId ? `: ${client.clientId}` : ''} (${clients.size} connected)`);
  });
  socket.on('error', () => {});
});

server.listen(port, '127.0.0.1', () => {
  log(`Loot queue ready: ws://127.0.0.1:${port}`);
  log('Stop with Ctrl+C. Queue is local-only and clears stale jobs on restart.');
});
setInterval(expireJobs, 1000).unref();
