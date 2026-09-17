# ゾーン側セキュリティ設定チェックリスト

対象: Cloudflare ゾーン **ai-ustyle.co.jp**（zone_id `026dcc206d9b1ae4b46ed8ba045276c3` / プラン **Free Website**）
コード側（`public/_headers` / `functions/_security.js` / Worker `[[ratelimits]]`）で届かない範囲をここで塞ぐ。

## 0. どちらで進めるか

- **A. スコープ限定のAPIトークンを1本作り、Hermesに全部やらせる（推奨・所要2分）**
  下の手順で作った値を `~/.config/secrets/cloudflare-zone.env` に1行置くだけ。以降は API で読み取り→適用→実測まで自動で回せる。
- **B. 自分でダッシュボードを触る（所要10〜15分）** → §1〜§5 のとおり。

確認済みの事実: wrangler の OAuth トークンは `zone:read` までで、**ゾーン設定/WAF/Bot/DNSSEC は読み書きとも `10000 Authentication error` / `9109 Unauthorized`**（2026-09-17 実測）。だから A では専用トークンが必要。

### A: トークン作成手順（値は会話に出さない）
1. https://dash.cloudflare.com/profile/api-tokens → **Create Token** → **Create Custom Token**
2. Permissions を次の5行（Zone Resources はすべて `Include → Specific zone → ai-ustyle.co.jp`）
   - Zone → **Zone Settings** → Edit
   - Zone → **Zone WAF** → Edit （Managed Ruleset と rate limiting rules に必要）
   - Zone → **Bot Management** → Edit （Bot Fight Mode に必要）
   - Zone → **DNS** → Edit （DNSSEC に必要）
   - Zone → **Zone** → Read
3. Continue to summary → Create Token → 表示された値をコピー（再表示不可）
4. ターミナル（`<貼り付け>` を置換。値はエコーされない）:
   `mkdir -p ~/.config/secrets && printf 'CLOUDFLARE_ZONE_TOKEN=%s\n' '<貼り付け>' > ~/.config/secrets/cloudflare-zone.env && chmod 600 ~/.config/secrets/cloudflare-zone.env`
5. Hermesに「ゾーン設定を適用して」と伝える → 下記の推奨値を適用し、実測結果まで報告する

### A で適用する推奨値
| 項目 | 値 |
| --- | --- |
| Always Use HTTPS | ON |
| Minimum TLS Version | TLS 1.2 |
| Automatic HTTPS Rewrites / Opportunistic Encryption / TLS 1.3 | ON |
| HSTS | Enable / `max-age=31536000` / **includeSubDomains は当面OFF** / preload OFF / nosniff ON |
| Security Level / Browser Integrity Check | Medium / ON |
| Bot Fight Mode | ON |
| Cloudflare Managed Ruleset | 有効（既定アクション Managed Challenge） |
| Rate limiting rule | `chat-api-flood` / `http.request.uri.path eq "/api/chat/stream"` / 5 requests per 10 seconds / per IP / Block（mitigation 10s）※Freeは1本・10秒のみ |
| DNSSEC | 有効化（レジストラ側のDS登録が別途必要。指示があればDSレコードを出す） |

> HSTS の `includeSubDomains` は「配下の全サブドメインがHTTPSで応答できる」ことを確認してから。誤るとHTTPのみのサブドメインが到達不能になる。

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
