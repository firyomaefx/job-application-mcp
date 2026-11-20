# Cloudflare Pages portal (static)

Deploy `index.html` to Cloudflare Pages. Before build, inject config (do **not** commit secrets):

```html
<script>
  window.API_BASE = "https://job-application-mcp-edge.<subdomain>.workers.dev";
  window.API_TOKEN = "<same token as EDGE_API_TOKEN — use Pages env + build inject, or Access>";
</script>
```

Set the Worker `ALLOWED_ORIGIN` to your Pages URL for CORS on resume upload.

Job listings and queue status (views 2–3) arrive in a later phase when the laptop pushes snapshots via `/api/sync/push`.