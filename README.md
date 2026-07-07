# ai-ustyle.co.jp

このディレクトリは `ai-ustyle.co.jp` 専用の新規案件。
既存案件とは混同しない。

基本方針
- Cloudflare / GitHub 操作は必ず `guard -- ...` 経由
- `wrangler` / `npx wrangler` / `gh` / `git push` を直実行しない
- custom domain / deploy / DNS / remote write は人間確認前提
- 既存 `oshi-*` 系リソースは参照・流用しない

現状
- 新規 repo を初期化済み
- `git remote origin` は未設定
- Cloudflare project / Worker名 / route / zone は未確定

次に決めること
1. Worker名
2. Pages か Workers(+assets) か
3. `ai-ustyle.co.jp` を apex `/` に載せるか
4. `git remote origin` URL

推奨暫定識別子
- repo: `ai-ustyle-co-jp`
- worker slug: `ai-ustyle-co-jp-worker`
- pages project slug: `ai-ustyle-co-jp-web`
- github repo: `ustylepromotion-hue/ai-ustyle-co-jp`
- label: `AI-USTYLE`
