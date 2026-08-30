# RO Loot Queue on Cloudflare

This is a Cloudflare Workers + Durable Object version of the local loot queue.
It is a separate deployment target and does **not** replace either local script:

- `scripts/loot-queue-poc.js` — local only (`ws://127.0.0.1:8787`)
- `scripts/loot-queue-railway.js` — Railway version

The userscript protocol is unchanged. It supports `hello`, `offer`, `claim`,
`renew`, `ack`, `discard`, and `nack`.

## Deploy

Prerequisites: a Cloudflare account and Node.js 20+.

```bash
cd cloudflare/loot-queue
npm install
npx wrangler login
npx wrangler secret put LOOT_QUEUE_TOKEN
npm run deploy
```

`wrangler secret put` prompts for the secret value without writing it into a
source file. Use a long random token and keep it private.

After a successful deploy, Wrangler prints a URL such as:

```text
https://ro-loot-queue.<account>.workers.dev
```

Put this exact URL in the **Local WebSocket URL** field of both game accounts,
changing `https` to `wss` and appending the token:

```text
wss://ro-loot-queue.<account>.workers.dev/?token=<LOOT_QUEUE_TOKEN>
```

Both accounts must also use the same queue group, for example `default`.

## Verify

Open the URL below in a browser (no token required):

```text
https://ro-loot-queue.<account>.workers.dev/health
```

It returns queue and connection counts. The Worker rejects unauthenticated
WebSocket upgrades with HTTP 401.

## Debug event log

The queue keeps the last 100 meaningful events: connection, offer, claim,
completion, discard, expiry, and lease reopen. View them live with:

```text
https://ro-loot-queue.<account>.workers.dev/debug?token=<LOOT_QUEUE_TOKEN>
```

Unlike Wrangler tail, this stays useful while the WebSocket remains open.
It never includes the token or account credentials. After adding this feature,
redeploy with `npm run deploy`.

## State and expiry

Jobs are stored in the Durable Object's SQLite-backed storage, so normal
Worker hibernation does not clear them. Jobs still expire according to the TTL
sent by the farmer, and claimed jobs reopen after a 20-second lease timeout.
