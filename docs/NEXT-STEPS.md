# NEXT STEPS

この案件の地盤を安全側で進める順番。

1. GitHub のこの案件専用 repo `ustylepromotion-hue/ai-ustyle-co-jp` を用意する
2. `git remote origin` を設定する
3. `npm install` 済み状態で `npm run check` を通す
4. guard 経由で `npm run cf:whoami` を試す
5. Cloudflare で新規に
   - Worker `ai-ustyle-co-jp-worker`
   - Pages project `ai-ustyle-co-jp-web`
   を作る
6. project 作成前に `docs/PROJECT_IDENTITY.md` を再確認する
7. deploy / custom domain は人間確認付きで進める

現時点では、まだ custom domain を付ける段階ではない。
