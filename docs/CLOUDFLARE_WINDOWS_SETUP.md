# Windows 11: Cloudflare Tunnel + edge sync

## Decisions (defaults for this repo)

| Choice | Decision |
| --- | --- |
| Sync direction | **Laptop polls** the public Worker (`scripts/edge-sync.mjs`) |
| Parser | **Node `parse_cv`** on the bridge (no extra FastAPI) |
| Auto-apply | **Playwright on laptop** only |
| Edge role | **R2 + KV buffer** when the PC is offline |

## 1. Deploy the edge Worker

```bash
cd edge/worker
npm install
# Create R2 bucket `job-mcp-resumes`, KV namespace; paste IDs into wrangler.jsonc
npx wrangler secret put EDGE_API_TOKEN
npm run deploy
```

## 2. Run the local bridge (auto-apply on)

```powershell
$env:JOB_MCP_AUTO_APPLY="1"
$env:JOB_MCP_ALL_TOOLS="1"
$env:JOB_MCP_HTTP_TOKEN="<long-random>"
npm run build
npm run serve:http
```

Or use the **desktop app** (sets auto-apply + full tools).

## 3. Optional: expose bridge via Tunnel

For remote debugging only (Worker sync does **not** require inbound tunnel):

```powershell
cloudflared tunnel create job-mcp
cloudflared tunnel route dns job-mcp api.yourdomain.com
# config.yml: ingress → http://127.0.0.1:8787
cloudflared service install
```

Protect with Cloudflare Access or rely on `JOB_MCP_HTTP_TOKEN`.

## 4. Sync agent (scheduled task)

```powershell
$env:JOB_MCP_EDGE_URL="https://job-application-mcp-edge.<account>.workers.dev"
$env:JOB_MCP_EDGE_TOKEN="<same as EDGE_API_TOKEN>"
$env:JOB_MCP_HTTP_TOKEN="<bridge token>"
$env:JOB_MCP_DATA_DIR="C:\path\to\data"
node scripts\edge-sync.mjs
```

**Task Scheduler:** trigger every 5 minutes when on AC power; also run at logon. The script is idempotent.

## 5. Playwright (file upload apply)

```powershell
cd desktop
npm install playwright
npm run playwright:install
```

Start the desktop **Playwright worker** after sync enqueues applies (see [AUTO_APPLY_CAMPAIGN.md](./AUTO_APPLY_CAMPAIGN.md)).

## Fail-safe recap

- Uploads land in **R2** until sync + ack.
- Apply intents sit in **KV** until `start_campaign` runs locally.
- CAPTCHA → queue `paused`; desktop notification when using the Electron app.