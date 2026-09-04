-- 最小スキーマ。テーブルは2つだけ。
-- visitors: 匿名Cookie(mn_vid)1本＝1行。無料枠カウンタと「前回の要約」をここに持つ。
-- messages: 会話ログ。LLMへの直近文脈と、resume_line生成の材料。

CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  daily_count INTEGER NOT NULL DEFAULT 0,
  daily_date TEXT NOT NULL,
  last_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_visitor ON messages (visitor_id, created_at);
