/**
 * Cloudflare edge buffer — resumes (R2) and apply intents (KV).
 * Heavy work stays on the laptop; this Worker only stores and serves sync APIs.
 */

export interface Env {
  PENDING: KVNamespace;
  RESUMES: R2Bucket;
  EDGE_API_TOKEN: string;
  ALLOWED_ORIGIN?: string;
}

interface PendingUpload {
  id: string;
  key: string;
  filename: string;
  uploaded_at: string;
  status: "pending";
}

interface PendingApply {
  id: string;
  url: string;
  title: string | null;
  created_at: string;
  status: "pending";
}

function corsHeaders(req: Request, env: Env): HeadersInit {
  const origin = req.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGIN;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (origin && allowed && origin === allowed) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  return headers;
}

function authorized(req: Request, env: Env): boolean {
  const token = env.EDGE_API_TOKEN;
  if (!token) return false;
  const header = req.headers.get("Authorization") ?? "";
  return header === `Bearer ${token}`;
}

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req, env) });
    }

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "job-application-mcp-edge" });
    }

    if (url.pathname === "/api/resume" && req.method === "POST") {
      if (!authorized(req, env)) {
        return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: corsHeaders(req, env) });
      }
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return Response.json({ ok: false, error: "file required" }, { status: 400, headers: corsHeaders(req, env) });
      }
      if (file.size > 10_000_000) {
        return Response.json({ ok: false, error: "file too large (max 10MB)" }, { status: 413, headers: corsHeaders(req, env) });
      }
      const id = crypto.randomUUID();
      const key = `resumes/${id}/${file.name.replace(/[^\w.\-()+@]/g, "_")}`;
      await env.RESUMES.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || "application/octet-stream" },
      });
      const meta: PendingUpload = {
        id,
        key,
        filename: file.name,
        uploaded_at: new Date().toISOString(),
        status: "pending",
      };
      await env.PENDING.put(`upload:${id}`, JSON.stringify(meta));
      return Response.json({ ok: true, data: meta }, { headers: corsHeaders(req, env) });
    }

    if (url.pathname === "/api/apply" && req.method === "POST") {
      if (!authorized(req, env)) {
        return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      const body = (await req.json()) as { url?: string; title?: string };
      if (!body.url || !/^https?:\/\//i.test(body.url)) {
        return Response.json({ ok: false, error: "valid url required" }, { status: 400 });
      }
      const id = crypto.randomUUID();
      const meta: PendingApply = {
        id,
        url: body.url,
        title: body.title ?? null,
        created_at: new Date().toISOString(),
        status: "pending",
      };
      await env.PENDING.put(`apply:${id}`, JSON.stringify(meta));
      return Response.json({ ok: true, data: meta });
    }

    if (url.pathname === "/api/sync/pending" && req.method === "GET") {
      if (!authorized(req, env)) {
        return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      const uploads: PendingUpload[] = [];
      const applies: PendingApply[] = [];
      let cursor: string | undefined;
      do {
        const list = await env.PENDING.list({ prefix: "upload:", cursor });
        for (const k of list.keys) {
          const v = await env.PENDING.get(k.name);
          if (v) uploads.push(JSON.parse(v) as PendingUpload);
        }
        cursor = list.list_complete ? undefined : list.cursor;
      } while (cursor);
      cursor = undefined;
      do {
        const list = await env.PENDING.list({ prefix: "apply:", cursor });
        for (const k of list.keys) {
          const v = await env.PENDING.get(k.name);
          if (v) applies.push(JSON.parse(v) as PendingApply);
        }
        cursor = list.list_complete ? undefined : list.cursor;
      } while (cursor);
      return Response.json({ ok: true, data: { uploads, applies } });
    }

    const downloadMatch = url.pathname.match(/^\/api\/sync\/download\/([^/]+)$/);
    if (downloadMatch && req.method === "GET") {
      if (!authorized(req, env)) {
        return new Response("Unauthorized", { status: 401 });
      }
      const id = downloadMatch[1];
      const metaRaw = await env.PENDING.get(`upload:${id}`);
      if (!metaRaw) {
        return Response.json({ ok: false, error: "upload not found" }, { status: 404 });
      }
      const meta = JSON.parse(metaRaw) as PendingUpload;
      const obj = await env.RESUMES.get(meta.key);
      if (!obj) {
        return Response.json({ ok: false, error: "object missing in R2" }, { status: 404 });
      }
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${meta.filename}"`,
        },
      });
    }

    if (url.pathname === "/api/sync/ack" && req.method === "POST") {
      if (!authorized(req, env)) {
        return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      const body = (await req.json()) as { upload_ids?: string[]; apply_ids?: string[] };
      for (const id of body.upload_ids ?? []) {
        const metaRaw = await env.PENDING.get(`upload:${id}`);
        if (metaRaw) {
          const meta = JSON.parse(metaRaw) as PendingUpload;
          await env.PENDING.delete(`upload:${id}`);
          await env.RESUMES.delete(meta.key);
        }
      }
      for (const id of body.apply_ids ?? []) {
        await env.PENDING.delete(`apply:${id}`);
      }
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: "not found" }, { status: 404 });
  },
};