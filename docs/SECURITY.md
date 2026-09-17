# SECURITY.md — ai-ustyle-co-jp セキュリティ対策（2026-09-17 追加）

このリポジトリで実施済みのセキュリティ対策と、その検証・運用方法。
**サイト構成・公開URL・既存機能は変更していない**（追加したのは検査とヘッダー、および異常時の遮断のみ）。

## 1. 何を守っているか（脅威モデル）

| 脅威 | 対策 |
| --- | --- |
| 他サイトのページからチャットAPIを叩かれる（API乱用・課金） | Origin検査（許可外は403でLLMに到達させない） |
| ボット/スクレイパによる連打（コスト消費） | IP単位レート制限（Workers Rate Limiting binding: 10回/60秒/1IP） |
| 大量IPからの分散攻撃による費用爆発 | D1の日次上限（全IP合計 **100通/日** ＋ 1IPあたり **30通/日**。migration 0002 適用で有効化） |
| 巨大ボディ・巨大入力によるWorker疲弊 | ボディ32KB上限（413）/ メッセージ2,000文字上限（既存） |
| プロンプトインジェクションによる内部情報奪取 | 出力フィルタ（システムプロンプト見出し・シークレット名・上流URL・モデルIDを検出したら応答を中断） |
| クリックジャッキング | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` |
| XSS・外部スクリプト注入 | CSP（許可ホストを明示。`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`） |
| 盗聴・ダウングレード | `Strict-Transport-Security` + Cloudflareの常時HTTPS |
| MIMEスニッフィング・情報漏洩 | `X-Content-Type-Options: nosniff` / `Referrer-Policy` / `Cross-Origin-Resource-Policy: same-site` |
| 機能悪用（カメラ等） | `Permissions-Policy` でほぼ全機能を無効化 |
| エラーからの内部情報漏洩 | APIエラーは一般的な日本語メッセージのみ（内部コード・上流URLを含めない） |
| シークレットのコミット混入 | `.gitignore` に `.dev.vars*` を追加（`USTYLEMAIN` 等は `wrangler secret`/Pages環境変数のみ） |

## 2. 実装ファイル

- `public/_headers`
  Cloudflare Pages / Workers Assets が解釈する静的ヘッダー定義。**CSPは 1ページにつき1つ**になるよう
  `/*` で定義し、`/test/ai/*` だけ `! Content-Security-Policy` で外して緩和版を再定義している
  （同ヘッダーを複数ルールで書くとカンマ連結されて壊れるため）。
- `functions/_security.js`
  共通の防壁モジュール（`_` 始まりなので Pages のルートにはならない）。
  Origin検査・IPレート制限・日次上限・ボディ上限・出力フィルタ・セキュリティヘッダー定義。
  **失敗時はフェイルオープン**（可用性優先。`console.warn` にだけ記録）。
- `functions/api/chat/stream.js`（本体チャット。Worker/Pages双方が使う）
- `functions/test/ai/api/chat/stream.js`（事務作業まるなげLPのチャット）
- `src/worker.js`（Worker配信面: ヘッダー後掛け・未定義 `/api/*` は404 JSON・`/healthz`）
- `wrangler.toml`（`[[ratelimits]] CHAT_RATE_LIMIT`）
- `migrations/0002_chat_usage_daily.sql`（日次上限カウンタ。適用前はフェイルオープン）

### 許可オリジン（既定）
`https://www.ai-ustyle.co.jp` / `https://ai-ustyle.co.jp` / 本体Workerの `*.workers.dev` / 同一オリジン。
`env.CHAT_ALLOWED_ORIGINS`（カンマ区切り）で追加可。**Originが無いリクエスト（curl等）は既存挙動どおり通す。**

### 調整ノブ（環境変数）
- `CHAT_DAILY_TOTAL`（既定 100）… 全IP合計の1日上限（0以下で無効化）
- `CHAT_IP_DAILY_TOTAL`（既定 30）… 1IPあたりの1日上限（0以下で無効化）
- カウンタは `chat_usage_daily(scope, day)` に scope=`global` / `ip:<address>` で記録（JST日付・アトミック加算）
- `CHAT_ALLOWED_ORIGINS` … 追加許可オリジン

## 3. 検証（毎回・デプロイ前後に実行）

```bash
node scripts/security-api-guard-test.mjs                  # 29項目・上流LLMはモック（課金なし）
node scripts/security-headers-check.mjs https://<対象URL>  # ヘッダー/API防壁の実測（14項目）
python3 scripts/security-csp-check.py https://<対象URL>    # 実ブラウザでCSP違反0・機能動作の確認
```

ローカルで本番同等に確認する場合（`_headers` とWorkerコードが同時に効く）:

```bash
npx wrangler dev --port 8789 --ip 127.0.0.1
node scripts/security-headers-check.mjs http://127.0.0.1:8789
python3 scripts/security-csp-check.py http://127.0.0.1:8789
```

## 4. 未適用 / 今後の任意項目

- **D1マイグレーション未適用**: 日次上限テーブルを作るまで日次上限はフェイルオープン（無効）。**未適用の間は日次100通の上限は効かない**。
  適用: `npx wrangler d1 execute ai-ustyle-marunage-chat --remote --file migrations/0002_chat_usage_daily.sql`
- **Pages Functions側のレート制限binding**: `wrangler.toml` の `[[ratelimits]]` は Worker にのみ効く。
  Pagesプロジェクトにも同名bindingを付けるにはダッシュボード/APIでの設定が必要（未実施でもIP制限はWorker側で効く）。
- **ゾーン(WAF)側**: Cloudflare Managed Ruleset / Bot Fight Mode / rate limiting rules / Minimum TLS 1.2 /
  Always Use HTTPS / HSTS 有効化はダッシュボード設定（人間判断）。
- **Turnstile（人間認証）**: 最強の対ボット策だがチャットUIへのトークン追加が必要＝**UI変更を伴うため未実施**。
- **www配下の未知パスが index.html を200で返す**（Pages側のSPAフォールバック挙動）。構造変更になるため未修正。

## 5. 壊してはいけない既知の挙動

- index.html のチャットは `data-endpoint` で **workers.dev の `/api/chat/stream`** を直接叩く（クロスオリジン）。
  → 許可オリジン集合から `*.workers.dev`/www/apex を外すとチャットが止まる。
- main.js は index.html のみが読む（`?v=N` を上げる運用）。**今回 main.js / HTML は変更していない。**
- `_headers` の `!` 外し（detach）は wrangler dev（Workers Assets）で実測済み。Pages側でも同挙動を
  デプロイ後に `scripts/security-headers-check.mjs` で必ず確認する（CSPが2つ連結されると /test/ai/ が壊れる）。

## 6. 本番反映後の実測（2026-09-17T22:12:25+09:00）

- Pages: preview `security-preview`(e9dee873) → 本番 `main`(25032029) をデプロイ。Functions bundle と `_headers` が同時に配信される。
- Worker: 人間TTYでデプロイ成功（Version ID `8fb9a7fc-a8b4-4680-896b-30c98346ced0`、`deployments list` で最新が100%）。
  - エージェント実行が1回ブロックされた原因: wrangler.toml に `[[ratelimits]]`/`[ratelimits.simple]` を足すと guard の RESOURCE_DOMAINS に `ratelimits.simple` が加わり、承認キーが不一致になる（設定形状を変えた時は人間TTYが1回必要。記録後はエージェント再deploy可）。
- 本番実測（すべてPASS）:
  - `security-headers-check`: workers.dev **15/15**、www **13/13**、apex **13/13**
  - `security-csp-check`（実ブラウザ）: www・workers.dev とも **pass=true**（6ページ・CSP違反0・JSエラー0・機能センチネルOK）
  - 実チャットE2E: 通常質問 → delta 76 + done（料金回答）＝**既存機能は無傷**
  - プロンプトインジェクション（システムプロンプト/キー名出力要求）→ 漏洩マーカー0件（モデルが拒否、出力フィルタの誤爆もなし）
- 未適用のまま: D1日次上限（migration 0002）、Pages Functions側のレート制限binding、ゾーンWAF設定。
