// Credit ledger — local accounting of AI credits per profile.
//
// Pro plans grant a monthly allowance; top-up codes add more. Each AI
// operation (tailor, cover letter, answer) debits 1 credit. The free core has
// 0 AI credits and uses heuristic fallbacks instead, so this module is only
// exercised when a Pro entitlement + balance exist.

import { openDb } from "../store/db.js";
import { getDefaultProfile } from "../store/profile.js";

type LedgerReason = "grant" | "topup" | "ai_tailor" | "ai_cover" | "ai_answer";

function now(): string {
  return new Date().toISOString();
}

function currentPeriod(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getRow(profileId: number): { balance: number; period: string } {
  const db = openDb();
  const row = db
    .prepare("SELECT balance, period FROM credit_balance WHERE profile_id = ?")
    .get(profileId) as { balance: number; period: string } | undefined;
  return row ?? { balance: 0, period: currentPeriod() };
}

function ledger(profileId: number, delta: number, reason: LedgerReason, ref?: string): void {
  const db = openDb();
  const ts = now();
  const before = getRow(profileId);
  const period = currentPeriod();
  // Monthly grant resets the balance when the period rolls over.
  const carry = before.period === period ? before.balance : 0;
  const next = carry + delta;
  db.prepare(
    `INSERT INTO credit_balance (profile_id, balance, period, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(profile_id) DO UPDATE SET balance = excluded.balance, period = excluded.period, updated_at = excluded.updated_at`
  ).run(profileId, next, period, ts);
  db.prepare(
    "INSERT INTO credit_ledger (profile_id, delta, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(profileId, delta, reason, ref ?? null, ts);
}

/** Grant a monthly allowance (idempotent per period via the period check). */
export function grantMonthly(profileId: number, amount: number): number {
  const before = getRow(profileId);
  if (before.period === currentPeriod() && before.balance > 0) {
    // Already granted this period — don't double-grant.
    return before.balance;
  }
  ledger(profileId, amount, "grant");
  return getRow(profileId).balance;
}

/** Apply a top-up code (Pro add-on). Returns the new balance. */
export function applyTopup(profileId: number, amount: number, code: string): number {
  const db = openDb();
  // Prevent the same code being applied twice.
  const dup = db
    .prepare("SELECT id FROM credit_ledger WHERE profile_id = ? AND reason = 'topup' AND ref = ?")
    .get(profileId, code);
  if (dup) throw new Error("top-up code already applied");
  ledger(profileId, amount, "topup", code);
  return getRow(profileId).balance;
}

/** Current balance for the default profile. */
export function balance(): number {
  return getRow(getDefaultProfile().id).balance;
}

/**
 * Try to debit one credit for an AI op. Returns true if debited, false if the
 * balance is empty (caller should fall back to the heuristic free path).
 */
export function tryDebit(reason: LedgerReason, ref?: string): boolean {
  const profileId = getDefaultProfile().id;
  const before = getRow(profileId);
  if (before.balance <= 0) return false;
  ledger(profileId, -1, reason, ref);
  return true;
}

export function history(profileId: number, limit = 50) {
  const db = openDb();
  return db
    .prepare(
      "SELECT id, delta, reason, ref, created_at FROM credit_ledger WHERE profile_id = ? ORDER BY id DESC LIMIT ?"
    )
    .all(profileId, limit);
}