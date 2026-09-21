import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export function getD1() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return env.DB;
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  if (schemaReady) return schemaReady;
  const db = getD1();
  schemaReady = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY NOT NULL,
      session_token TEXT NOT NULL UNIQUE,
      nickname TEXT NOT NULL UNIQUE,
      gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
      avatar TEXT NOT NULL DEFAULT '💌',
      job TEXT NOT NULL DEFAULT '참가자',
      is_sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS choices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id TEXT NOT NULL REFERENCES participants(id),
      recipient_id TEXT NOT NULL REFERENCES participants(id),
      stage INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 3),
      heart_color TEXT NOT NULL CHECK (heart_color IN ('red', 'yellow')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_choices_sender_stage_color ON choices(sender_id, stage, heart_color)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_choices_recipient_stage ON choices(recipient_id, stage)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_nickname ON participants(nickname)"),
  ]).then(() => undefined);
  return schemaReady;
}
