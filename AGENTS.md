# AGENTS.md — ai-ustyle-co-jp

この repo が **ai-ustyle.co.jp 本体（Cloudflare Pages: `ai-ustyle-co-jp-web`）の正本**。
Pages は直接アップロード運用（Git連携なし）だが、デプロイ元は必ずこの repo。

## ドメイン構造（2026-07-15 実測。デプロイ先を選ぶ前にここを読む）

- apex `ai-ustyle.co.jp` / www `www.ai-ustyle.co.jp` は**両方この Pages のカスタムドメイン**（CNAME→pages.dev、プロキシON）。
- zone の Worker route は **apex では発火するが、www では発火しない**。www は pages.dev プロパティに直結しており、wrangler.toml に www の route を書いてもデプロイは通るが一切実行されない。
- したがって **www 配下で何かを公開する唯一の方法は、この repo の `public/` に実ファイルを置く（か `_redirects` で飛ばす）こと**。

## 配下コンテンツの所属

- `public/` 直下 = 本体コーポレートサイト（index/company/pricing/usecase-ebay + assets）
- `public/_redirects` = lifecreate 用 301（www・pages.dev → apex）。**消すな**。消すと www.ai-ustyle.co.jp/lifecreate が本体SPAに飲まれる。
- `public/test/ai/` = 事務作業まるなげ無料お試しLP。**正本は `~/Desktop/業種別対応のLPデザイン/`**（事務作業まるなげ無料お試しLP.dc.html + support.js + image-slot.js + images/）。編集は正本側→cp→デプロイ。
- lifecreate LP 本体は別案件: repo `ustylepromotion-hue/lifecreate`（Worker `lifecreate`、apex の route で配信）。**この repo に他案件のLPを置かない。lifecreate repo にこの案件のLPを置かない。**

## デプロイ手順

```
cd /Users/ust/dev/ai-ustyle-co-jp
# 1. 変更を commit
# 2. デプロイ（guard が PREFIX 完全一致で自動承認）
guard -- npx wrangler pages deploy public --project-name ai-ustyle-co-jp-web --branch main --commit-dirty=true
# 3. repo を正本に保つ
guard -- git push origin main
```

**直接アップロードだけして repo に残さない、を二度とやらない**（2026-07-13 に `_redirects` が repo 外で追加され、次のデプロイで消えかけた）。

## デプロイ後の検証

要求された URL **そのもの**を全部叩く。apex が動いても www を確認するまで完了と言わない。
最低限: `www/test/ai/`・`apex/test/ai/`・`www/`・`apex/`・`www/lifecreate/`(301)・`apex/lifecreate/`(200)。
