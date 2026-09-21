import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const participants = sqliteTable("participants", {
  id: text("id").primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  nickname: text("nickname").notNull().unique(),
  gender: text("gender", { enum: ["male", "female"] }).notNull(),
  avatar: text("avatar").notNull().default("💌"),
  job: text("job").notNull().default("참가자"),
  isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const choices = sqliteTable("choices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  senderId: text("sender_id").notNull().references(() => participants.id),
  recipientId: text("recipient_id").notNull().references(() => participants.id),
  stage: integer("stage").notNull(),
  heartColor: text("heart_color", { enum: ["red", "yellow"] }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_choices_sender_stage_color").on(table.senderId, table.stage, table.heartColor),
]);
