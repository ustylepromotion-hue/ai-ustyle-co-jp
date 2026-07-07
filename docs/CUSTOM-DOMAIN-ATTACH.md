# CUSTOM DOMAIN ATTACH

対象
- domain: `ai-ustyle.co.jp`
- Pages project: `ai-ustyle-co-jp-web`
- Cloudflare zone id: `026dcc206d9b1ae4b46ed8ba045276c3`
- zone status: active / full / このアカウント管理下

確認済み前提
- `ai-ustyle.co.jp` は既にCloudflare管理下
- NS: `amber.ns.cloudflare.com`, `sonny.ns.cloudflare.com`
- 既存案件とは別物。混同しない。

カスタムドメイン接続コマンド
- この操作は DNS/ドメイン変更を伴うため、guard の人間確認必須。

手順A: Pages project に custom domain を追加
```bash
cd /Users/ust/dev/ai-ustyle-co-jp
guard -- npx wrangler pages domain add ai-ustyle.co.jp --project-name ai-ustyle-co-jp-web
```

手順B: 追加後に自動で出るDNS検証/CNAME要件を確認
- 通常、Pagesが `ai-ustyle.co.jp` 用に CNAME を自動作成する。
- 既にCloudflare管理下の場合は手動DNS追加は不要なことが多い。

手順C: 本番反映確認
```bash
curl -sS -L --max-time 20 https://ai-ustyle.co.jp/ -o /tmp/aiustyle_prod.html -w "HTTP %{http_code}\n"
```

注意
- `www.ai-ustyle.co.jp` も必要なら別途 domain add する。
- apex と www は別ドメイン扱い。
- 接続後、 cert 発行まで数分かかる場合がある。
