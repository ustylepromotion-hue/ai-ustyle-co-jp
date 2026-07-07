# DEPLOYMENT STATE

更新: 2026-07-07

作成済み
- GitHub repo: https://github.com/ustylepromotion-hue/ai-ustyle-co-jp
- Cloudflare Pages project: `ai-ustyle-co-jp-web`
- Pages preview deploy: `https://f1193540.ai-ustyle-co-jp-web.pages.dev`
- Pages production deploy: https://f1193540.ai-ustyle-co-jp-web.pages.dev  (Production / main)
- Worker: `ai-ustyle-co-jp-worker`
- Worker URL: https://ai-ustyle-co-jp-worker.ustyle-promotion.workers.dev

未完了
- `git push -u origin main`
- Worker `ai-ustyle-co-jp-worker` の初回 deploy
- `ai-ustyle.co.jp` の custom domain 接続

実行済み（人間visible terminal）
- `git push -u origin main` -> OK
- `npx wrangler deploy` -> OK。Worker公開済み

ブロッカー
- guard が destructive operations を非対話Hermes実行からブロックする
- 実際に止まったコマンド:
  - `guard -- git push -u origin main`
  - `guard -- npx wrangler deploy`

確認済み
- Worker `/healthz` -> `{"ok":true,"project":"ai-ustyle-co-jp-worker"}`
- Worker root -> HTTP 200
- Pages production deployment -> Production / main / Active
- `ai-ustyle.co.jp` はCloudflare zone管理下 (active/full)
  - zone id: `026dcc206d9b1ae4b46ed8ba045276c3`

補足
- Pages deploy 自体は既存/期待project名一致として auto-approved で成功
- preview URL は直後のTLSハンドシェイクでまだ不安定。反映待ちの可能性あり
