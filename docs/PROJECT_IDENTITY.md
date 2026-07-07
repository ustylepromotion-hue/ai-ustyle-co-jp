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
- cloudflare worker deployed: no
- github push completed: no
- pages deployment completed: no
- custom domain attached: no
