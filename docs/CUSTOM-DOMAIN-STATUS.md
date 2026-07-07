# CUSTOM DOMAIN STATUS

更新: 2026-07-07

追加リクエスト済み
- `ai-ustyle.co.jp` (Pages domain id: 2c914c08-e293-4596-b849-c0f11590b692)
- `www.ai-ustyle.co.jp` (Pages domain id: 42ba2eb4-ed73-4715-be38-2b553e7887e0)
- Pages project: `ai-ustyle-co-jp-web`
- zone: `ai-ustyle.co.jp` (zone id: 026dcc206d9b1ae4b46ed8ba045276c3)

現在の状態
- 両ドメイン status: `pending`
- verification: `CNAME record not set`

課題
- Cloudflareが自動でCNAMEを作成していない
- wrangler token では DNS record API が `Authentication error` (権限不足)
  - このトークンでは zone DNS read/write 不可
- そのため DNS レコード追加は Dashboard から手動が必要

手動で必要なDNSレコード（Cloudflare Dashboard > DNS > Records）
1. apex
   - Type: CNAME
   - Name: `@` (または `ai-ustyle.co.jp`)
   - Target: `ai-ustyle-co-jp-web.pages.dev`
   - Proxy: ON (orange cloud)
2. www
   - Type: CNAME
   - Name: `www`
   - Target: `ai-ustyle-co-jp-web.pages.dev`
   - Proxy: ON (orange cloud)

補足
- Pages + 同一アカウントzone の場合、通常はPagesが自動でレコードを作る。
- 今回は作られていないため手動追加。
- レコード追加後、数分で verification が通り、cert が発行される。

確認コマンド（権限が通るトークンで）
- Pages domain一覧: API `GET /accounts/{account}/pages/projects/ai-ustyle-co-jp-web/domains`
- 本番確認: `curl -sS -L https://ai-ustyle.co.jp/ -w "\nHTTP %{http_code}\n"`
