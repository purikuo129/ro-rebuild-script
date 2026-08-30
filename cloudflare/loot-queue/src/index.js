// Cloudflare Workers + Durable Object implementation of the loot queue.
// It deliberately does not replace scripts/loot-queue-poc.js or
// scripts/loot-queue-railway.js.  Both account scripts use the same JSON
// WebSocket protocol as the local POC.

const MAX_TTL_MS = 120_000;
const MIN_TTL_MS = 5_000;
const LEASE_MS = 20_000;
const MAX_GROUP_LENGTH = 48;
const MAX_CLIENT_ID_LENGTH = 80;
const JOB_PREFIX = 'job:';
const EVENT_LOG_KEY = 'recent-events';
const MAX_RECENT_EVENTS = 100;

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function makeClaimToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const dropId = Number(raw.dropId) >>> 0;
  const itemId = Number(raw.itemId) | 0;
  const map = cleanText(raw.map, 64);
  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!dropId || !itemId || !map || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    dropId,
    itemId,
    itemName: cleanText(raw.itemName || itemId, 120),
    map,
    x,
    y,
  };
}

function nextDeadline(job) {
  return job.state === 'claimed' ? Math.min(job.expiresAt, job.leaseUntil) : job.expiresAt;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const queue = env.LOOT_QUEUE.get(env.LOOT_QUEUE.idFromName('global'));
    if (url.pathname === '/health') {
      return queue.fetch(new Request('https://queue.internal/health'));
    }
    if (url.pathname === '/debug') {
      if (!env.LOOT_QUEUE_TOKEN || url.searchParams.get('token') !== env.LOOT_QUEUE_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }
      return queue.fetch(new Request('https://queue.internal/debug'));
    }
    if (url.pathname !== '/') return new Response('Not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket upgrade required; use /health for health checks.\n', { status: 426 });
    }
    if (!env.LOOT_QUEUE_TOKEN || url.searchParams.get('token') !== env.LOOT_QUEUE_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }
    return queue.fetch(request);
  },
};

export class LootQueue {
  constructor(ctx) {
    this.ctx = ctx;
    this.serial = Promise.resolve();
  }

  async fetch(request) {
    return this.runSerial(() => this.handleFetch(request));
  }

  async handleFetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      await this.expireJobs();
      const jobs = await this.listJobs();
      return json({
        ok: true,
        service: 'loot-queue-cloudflare',
        connections: this.ctx.getWebSockets().length,
        jobs: jobs.length,
        openJobs: jobs.filter((job) => job.state === 'open').length,
      });
    }
    if (url.pathname === '/debug') {
      await this.expireJobs();
      const events = (await this.ctx.storage.get(EVENT_LOG_KEY)) || [];
      return json({
        ok: true,
        service: 'loot-queue-cloudflare',
        connections: this.ctx.getWebSockets().length,
        events,
      });
    }
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.send(server, { type: 'hello', service: 'loot-queue-cloudflare', connections: this.ctx.getWebSockets().length });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, rawMessage) {
    return this.runSerial(() => this.handleWebSocketMessage(socket, rawMessage));
  }

  async handleWebSocketMessage(socket, rawMessage) {
    let message;
    try {
      message = JSON.parse(typeof rawMessage === 'string' ? rawMessage : new TextDecoder().decode(rawMessage));
    } catch (_) {
      this.send(socket, { type: 'error', reason: 'invalid JSON' });
      return;
    }
    await this.handle(socket, message);
  }

  webSocketClose(socket) {
    try { socket.close(); } catch (_) {}
  }

  webSocketError(socket) {
    try { socket.close(); } catch (_) {}
  }

  async alarm() {
    return this.runSerial(() => this.expireJobs());
  }

  runSerial(task) {
    const next = this.serial.catch(() => {}).then(task);
    this.serial = next;
    return next;
  }

  send(socket, message) {
    try { socket.send(JSON.stringify(message)); } catch (_) {}
  }

  metadata(socket) {
    return socket.deserializeAttachment() || null;
  }

  broadcast(group, message) {
    for (const socket of this.ctx.getWebSockets()) {
      if (this.metadata(socket)?.group === group) this.send(socket, message);
    }
  }

  async listJobs() {
    const rows = await this.ctx.storage.list({ prefix: JOB_PREFIX });
    return [...rows.values()];
  }

  async jobsForGroup(group, state) {
    const jobs = await this.listJobs();
    return jobs.filter((job) => job.group === group && (!state || job.state === state));
  }

  async saveJob(job) {
    await this.ctx.storage.put(JOB_PREFIX + job.id, job);
    await this.scheduleExpiry();
  }

  async deleteJob(job) {
    await this.ctx.storage.delete(JOB_PREFIX + job.id);
    await this.scheduleExpiry();
  }

  async scheduleExpiry() {
    const jobs = await this.listJobs();
    if (!jobs.length) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const dueAt = Math.min(...jobs.map(nextDeadline));
    await this.ctx.storage.setAlarm(Math.max(Date.now() + 1, dueAt));
  }

  async recordEvent(type, details = {}) {
    const entry = { at: new Date().toISOString(), type, ...details };
    const events = (await this.ctx.storage.get(EVENT_LOG_KEY)) || [];
    events.push(entry);
    if (events.length > MAX_RECENT_EVENTS) events.splice(0, events.length - MAX_RECENT_EVENTS);
    await this.ctx.storage.put(EVENT_LOG_KEY, events);
    console.log({ source: 'loot-queue', ...entry });
  }

  async expireJobs() {
    const now = Date.now();
    const jobs = await this.listJobs();
    for (const job of jobs) {
      if (job.expiresAt <= now) {
        await this.ctx.storage.delete(JOB_PREFIX + job.id);
        this.broadcast(job.group, { type: 'expired', id: job.id });
        await this.recordEvent('expired', {
          group: job.group, id: job.id, itemId: job.itemId, itemName: job.itemName,
          map: job.map, x: Math.round(job.x), y: Math.round(job.y),
        });
        continue;
      }
      if (job.state === 'claimed' && job.leaseUntil <= now) {
        job.state = 'open';
        job.claimedBy = null;
        job.claimToken = null;
        job.leaseUntil = 0;
        await this.ctx.storage.put(JOB_PREFIX + job.id, job);
        this.broadcast(job.group, { type: 'available', job });
        await this.recordEvent('lease-reopened', {
          group: job.group, id: job.id, itemId: job.itemId, itemName: job.itemName,
        });
      }
    }
    await this.scheduleExpiry();
  }

  async releaseJob(job, reason) {
    job.state = 'open';
    job.claimedBy = null;
    job.claimToken = null;
    job.leaseUntil = 0;
    await this.saveJob(job);
    this.broadcast(job.group, { type: 'available', job });
    await this.recordEvent('released', {
      group: job.group, id: job.id, itemId: job.itemId, itemName: job.itemName,
      reason: cleanText(reason, 160),
    });
  }

  async handle(socket, message) {
    if (!message || typeof message !== 'object') return;
    await this.expireJobs();

    if (message.type === 'hello') {
      const group = cleanText(message.group || 'default', MAX_GROUP_LENGTH) || 'default';
      const clientId = cleanText(message.clientId || 'anonymous', MAX_CLIENT_ID_LENGTH) || 'anonymous';
      const role = message.role === 'collector' ? 'collector' : 'farm';
      socket.serializeAttachment({ group, clientId, role });
      this.send(socket, { type: 'welcome', service: 'loot-queue-cloudflare', group });
      await this.recordEvent('connected', { group, role });
      const open = await this.jobsForGroup(group, 'open');
      if (open.length) this.send(socket, { type: 'available', jobs: open });
      return;
    }

    const client = this.metadata(socket);
    if (!client) {
      this.send(socket, { type: 'error', reason: 'send hello first' });
      return;
    }

    if (message.type === 'offer') {
      const record = safeRecord(message.record);
      if (!record) return this.send(socket, { type: 'error', reason: 'invalid offer' });
      const id = `${client.group}:${record.map}:${record.dropId}`;
      const existing = await this.ctx.storage.get(JOB_PREFIX + id);
      if (existing) return this.send(socket, { type: 'offered', id, duplicate: true });
      const now = Date.now();
      const requestedTtl = Number(message.ttlMs) || 45_000;
      const ttlMs = Math.max(MIN_TTL_MS, Math.min(MAX_TTL_MS, requestedTtl));
      const job = {
        ...record,
        id,
        group: client.group,
        state: 'open',
        createdAt: now,
        expiresAt: now + ttlMs,
        claimedBy: null,
        claimToken: null,
        leaseUntil: 0,
      };
      await this.saveJob(job);
      this.send(socket, { type: 'offered', id });
      this.broadcast(client.group, { type: 'available', job });
      await this.recordEvent('offered', {
        group: client.group, id, itemId: job.itemId, itemName: job.itemName,
        map: job.map, x: Math.round(job.x), y: Math.round(job.y),
      });
      return;
    }

    const id = String(message.id || '');
    const job = await this.ctx.storage.get(JOB_PREFIX + id);
    if (!job || job.group !== client.group) return this.send(socket, { type: 'error', reason: 'job not found' });

    if (message.type === 'claim') {
      if (job.state !== 'open') return this.send(socket, { type: 'unavailable', id: job.id });
      job.state = 'claimed';
      job.claimedBy = client.clientId;
      job.claimToken = makeClaimToken();
      job.leaseUntil = Date.now() + LEASE_MS;
      await this.saveJob(job);
      this.send(socket, { type: 'claimed', job, claimToken: job.claimToken });
      await this.recordEvent('claimed', {
        group: client.group, id: job.id, itemId: job.itemId, itemName: job.itemName,
      });
      return;
    }

    if (job.claimedBy !== client.clientId || job.claimToken !== message.claimToken) {
      return this.send(socket, { type: 'error', reason: 'claim mismatch' });
    }

    if (message.type === 'renew') {
      job.leaseUntil = Date.now() + LEASE_MS;
      await this.saveJob(job);
      return;
    }

    if (message.type === 'ack' || message.type === 'discard') {
      await this.deleteJob(job);
      const type = message.type === 'ack' ? 'completed' : 'discarded';
      this.broadcast(client.group, {
        type,
        id: job.id,
        itemId: job.itemId,
        itemName: job.itemName,
        reason: cleanText(message.reason, 160),
      });
      const open = await this.jobsForGroup(client.group, 'open');
      if (open.length) this.broadcast(client.group, { type: 'available', jobs: open });
      await this.recordEvent(type, {
        group: client.group, id: job.id, itemId: job.itemId, itemName: job.itemName,
        reason: cleanText(message.reason, 160),
      });
      return;
    }

    if (message.type === 'nack') {
      await this.releaseJob(job, message.reason);
    }
  }
}
