// Ollama reachability probe (v0.4.0). Kept in its own module so tests can stub
// `probeOllama` without dragging in the full detect builder.
//
// Hits the OpenAI-compatible `/models` endpoint on the local Ollama server.
// Loopback only by default; keyless. Any error or timeout → `reachable: false`
// (never throws — detection must not break the UI).

export async function probeOllama(
  baseUrl = "http://localhost:11434/v1",
  timeoutMs = 1500
): Promise<{ reachable: boolean; models?: string[] }> {
  const url = baseUrl.replace(/\/$/, "") + "/models";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { reachable: false };
    const json = (await res.json()) as { data?: { id?: string }[] };
    const models = Array.isArray(json.data)
      ? json.data.map((m) => m.id).filter((m): m is string => typeof m === "string")
      : [];
    return { reachable: true, models };
  } catch {
    return { reachable: false };
  }
}