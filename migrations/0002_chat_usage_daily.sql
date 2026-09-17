-- チャットAPIのコスト絶対上限用カウンタ（全IP合計・JST日付）。
-- Worker/Pages Functions 側は functions/_security.js checkDailyBudget() で
-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING count する（アトミック）。
-- テーブルが無い間はコードがフェイルオープンする（既存挙動を壊さない）。
-- 適用: npx wrangler d1 execute ai-ustyle-marunage-chat --remote --file migrations/0002_chat_usage_daily.sql

CREATE TABLE IF NOT EXISTS chat_usage_daily (
  day TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);