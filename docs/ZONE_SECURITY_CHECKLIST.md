# ゾーン側セキュリティ設定チェックリスト（人間がダッシュボードで実施）

対象: Cloudflare アカウントのゾーン **ai-ustyle.co.jp**（apex/www を配信）。
コード側（`public/_headers` / `functions/_security.js` / Worker `[[ratelimits]]`）で届かない範囲をここで塞ぐ。
所要 10〜15分。各項目は独立してON/OFFできるので、問題があれば1つずつ戻せる。

## 1. SSL/TLS → Edge Certificates

| 設定 | 推奨値 | 理由 |
| --- | --- | --- |
| Always Use HTTPS | **ON** | http→https リダイレクト。HSTSとセットで初めて意味が出る |
| Minimum TLS Version | **TLS 1.2** | 1.0/1.1 は既に非推奨 |
| Opportunistic Encryption | ON | 任意（無害） |
| TLS 1.3 | ON | 既定でON |
| HTTP Strict Transport Security (HSTS) | **有効 / Max Age 12 months / Include subdomains は当面OFF / Preload は最後** | コード側でも `max-age=31536000` を返しているが、ゾーン設定で二重に担保。**includeSubDomains は ai-ustyle.co.jp 配下の全サブドメインがHTTPSであることを確認してから**（HTTPのみのサブドメインがあると到達不能になる） |
| Automatic HTTPS Rewrites | ON | 混在コンテンツの救済 |

## 2. Security → Settings（旧 WAF ページ）

| 設定 | 推奨値 | 補足 |
| --- | --- | --- |
| Security Level | Medium（荒れている時は High） | 過剰にすると正規ユーザーもチャレンジされる |
| Bot Fight Mode | **ON** | Freeプランで使える簡易ボット対策。既知の悪性ボットにチャレンジを課す |
| Browser Integrity Check | ON | 不審なUA/ヘッダを弾く |
| Challenge Passage | 30分（既定） | 変更不要 |
| Email Obfuscation | ON（既にON） | 既存挙動 |

## 3. Security → WAF → Managed rules

- **Cloudflare Managed Ruleset を有効化**（Freeプランでも利用可）。既定アクションは Managed Challenge のままでよい。
- まずは「Log」ではなく既定の有効化で開始し、誤検知が出たらそのルールだけ個別に無効化する。

## 4. Security → WAF → Rate limiting rules

Free プランの制約: **ルールは1本のみ / カウント期間は10秒のみ / mitigation timeout 10秒のみ /
expression で使えるのは Path（と Verified Bot）/ カウント特性は IP + colo（必須）**。
（Pro 以上なら 60秒・複数ルールが使える。プランはダッシュボード右上のプラン名で確認できる）

推奨ルール（Freeプランの場合）:

```
名前: chat-api-flood
If incoming requests match:  http.request.uri.path eq "/api/chat/stream"
With the same:               IP + Cloudflare データセンター
Requests:                   5 requests per 10 seconds
Then:                       Block（mitigation timeout 10秒）
```

- これで www / apex の Pages Functions 経由チャット（`/api/chat/stream`）がエッジで止まる。
- **workers.dev 面はゾーン外**なので、このルールは効かない。そちらは Worker 内の
  `CHAT_RATE_LIMIT`（10リクエスト/60秒/IP）が担当（適用済み）。
- 60秒単位にしたい場合は Pro 以上で `10 requests per 60 seconds` に置き換える。

## 5. 任意（効果は大きいが副作用も理解してから）

| 項目 | 内容 | 注意 |
| --- | --- | --- |
| Turnstile | チャット送信時の人間認証。最強の対ボット策 | **チャットUIの改修が必要**（`main.js` にトークン入力欄とポーリング処理）。UI変更＝既存仕様変更になるため未実施 |
| DNSSEC | DNS レスポンスの改ざん防止 | レジストラ側でもDSレコード設定が必要 |
| Security → Events の監視 | 誤検知・攻撃の確認 | ルール追加後は数日見る |
| Under Attack Mode | 緊急時の全チャレンジ | 常用しない（正規流入も止まる） |

## 6. 設定後の確認

1. ブラウザで通常表示できる: `https://www.ai-ustyle.co.jp/`、`/test/ai/`、`/transportation/`
2. チャットが通常動作する（社内で1往復）
3. レート制限の実測: 同じ回線から `https://www.ai-ustyle.co.jp/api/chat/stream` に短時間で6回POSTすると、
   4回目以降が Cloudflare の 429/ブロックページになる（正規の会話では10秒に5回は普通超えない）
4. Cloudflare ダッシュボード → Security → Events に Block/Challenge が記録されている

## 7. コード側（参考・適用済み）

- チャットAPI: Origin検査（許可外403）/ Content-Type検査（415）/ ボディ32KB上限（413）/
  IPレート制限（Workers Rate Limiting binding）/ D1日次上限（**テーブル未作成のため未発動**）/ 出力フィルタ
- 全静的アセット: CSP・HSTS・X-Frame-Options DENY・nosniff・Referrer-Policy・Permissions-Policy・COOP・CORP
- 検証コマンドは `docs/SECURITY.md` §3 を参照。
