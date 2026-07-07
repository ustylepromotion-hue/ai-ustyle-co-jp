# PROJECT IDENTITY

project_label: AI-USTYLE
repo_slug: ai-ustyle-co-jp
worker_slug: ai-ustyle-co-jp-worker
pages_project_slug: ai-ustyle-co-jp-web
github_repo: ustylepromotion-hue/ai-ustyle-co-jp
intended_domain: ai-ustyle.co.jp

rules:
- 既存案件と混同しない
- 既存 Worker / Pages / D1 / KV を流用しない
- Cloudflare / GitHub 操作は必ず guard 経由
- deploy / DNS / custom domain 接続は人間確認付き

do_not_mix_with:
- oshi-diagnosis
- oshi-shindan
- ustyle-promotion.workers.dev

status:
- git repo initialized: yes
- git remote origin configured: yes
- github repo created: yes
- cloudflare pages project created: yes
- cloudflare worker deployed: yes
- github push completed: yes
- pages deployment completed: yes
- custom domain attached: no

resources:
- github: https://github.com/ustylepromotion-hue/ai-ustyle-co-jp
- pages project: ai-ustyle-co-jp-web
- pages prod url: https://f1193540.ai-ustyle-co-jp-web.pages.dev
- worker: ai-ustyle-co-jp-worker
- worker url: https://ai-ustyle-co-jp-worker.ustyle-promotion.workers.dev
- cloudflare zone id: 026dcc206d9b1ae4b46ed8ba045276c3
- zone: ai-ustyle.co.jp (active/full)

notes:
- pages preview url: https://f1193540.ai-ustyle-co-jp-web.pages.dev
- github push and worker deploy are blocked in Hermes CLI because guard requires a human interactive terminal for destructive operations
