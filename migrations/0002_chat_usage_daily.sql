-- チャットAPIの日次上限カウンタ（JST日付・scope単位）。
-- scope='global'      : 全IP合計（コストの絶対上限。既定100通/日）
-- scope='ip:<address>': 1IPあたり（既定30通/日。単一IPが全体枠を食い潰すのを防ぐ）
-- Worker/Pages Functions 側は functions/_security.js bumpDailyCounter() で
-- INSERT ... ON CONFLICT(scope, day) DO UPDATE ... RETURNING count する（アトミック）。
-- テーブルが無い間はコードがフェイルオープンする（既存挙動をさない）。
-- 適用: guard -- npx wrangler d1 execute ai-ustyle-marunage-chat --remote --file migrations/0002_chat_usage_daily.sql

CREATE TABLE IF NOT EXISTS chat_usage_daily (
  scope TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  PRIMARY KEY (scope, day)
);

CREATE INDEX IF NOT EXISTS idx_chat_usage_daily_day ON chat_usage_daily (day);