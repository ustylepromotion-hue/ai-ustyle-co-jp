# GUARD FIRST CHECKLIST

Cloudflare作業前に毎回確認すること。

1. いまの作業場所が `/Users/ust/dev/ai-ustyle-co-jp` である
2. `docs/PROJECT_IDENTITY.md` がこの案件を指している
3. `git remote origin` がこの案件専用 repo を指す
4. `wrangler.toml` の `name` がこの案件専用である
5. 既存案件の project / domain / route 名がコマンドに含まれていない
6. deploy, DNS, custom domain は guard + 人間確認前提で進める

禁止
- 既存 repo でそのまま `wrangler` を叩く
- custom domain を未確認の project に付ける
- route / zone を推測で書く
