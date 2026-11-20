# Edge Worker (`job-application-mcp-edge`)

Buffers resume uploads (R2) and apply URLs (KV) when the laptop is offline. Deploy with Wrangler:

```bash
npm install
# Replace KV IDs in wrangler.jsonc; create R2 bucket job-mcp-resumes
npx wrangler secret put EDGE_API_TOKEN
npm run deploy
```

Set `ALLOWED_ORIGIN` to your Cloudflare Pages URL for browser uploads.

Laptop: `JOB_MCP_EDGE_URL` + `JOB_MCP_EDGE_TOKEN`, then `npm run edge:sync` from the repo root (bridge must be up with `JOB_MCP_AUTO_APPLY=1` for apply intents).