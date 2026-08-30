# RO Rebuild Script

Tampermonkey userscript for RO Rebuild automation.

## Source of truth

Edit only `RO Rebuild Web Assist-4.57.0.js`.
Before committing a release, publish the Tampermonkey artifact:

```sh
./scripts/publish-userscript.sh
```

`ro-rebuild-web-assist.user.js` is the generated file served to Tampermonkey.

## Required hosted assets

- `maps-gat/` — GAT map data loaded on demand by the userscript.
- `items.csv` and `items/` — item names, metadata, and icons.

## Local loot queue

Run the local relay when using Localhost queue mode:

```sh
node scripts/loot-queue-poc.js
```

Cloudflare Worker source is in `cloudflare/loot-queue/`. Never commit Cloudflare secrets or local `.env` files.
