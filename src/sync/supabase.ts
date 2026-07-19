// Cloud sync seam — Pro only, env-gated.
//
// This is a SEAM, not a live integration. It defines the sync interface and a
// no-op local fallback. When SUPABASE_URL + SUPABASE_ANON_KEY are configured AND
// the entitlement has the "cloud_sync" feature, a real implementation would
// push/pull application records to a Supabase table. Wiring the Supabase JS
// client is a Pro deployment task (it requires a Supabase project + schema).
//
// Nothing here runs in the free core. `enabled()` is false without env + entitlement.

import { featureEnabled } from "../features.js";

export interface SyncRecord {
  table: "applications" | "jobs" | "cvs" | "profiles";
  id: number;
  payload: unknown;
  updated_at: string;
}

export interface SyncClient {
  push(records: SyncRecord[]): Promise<void>;
  pull(since: string): Promise<SyncRecord[]>;
}

class LocalNoopSync implements SyncClient {
  async push(_records: SyncRecord[]): Promise<void> {
    // no-op: free core / unconfigured
  }
  async pull(_since: string): Promise<SyncRecord[]> {
    return [];
  }
}

/** Is cloud sync actually available right now? */
export function enabled(): boolean {
  if (!featureEnabled("cloud_sync")) return false;
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

/**
 * Return a sync client. Currently always the local no-op; a real Supabase
 * client would be constructed here when `enabled()` is true. Kept as a seam so
 * tools can call `getSyncClient().push(...)` today without Pro infra.
 */
export function getSyncClient(): SyncClient {
  // When wiring Supabase: if (enabled()) return new SupabaseSync(url, key);
  return new LocalNoopSync();
}