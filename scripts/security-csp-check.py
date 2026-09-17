#!/usr/bin/env python3
"""CSP/セキュリティヘッダー適用後の実ブラウザ検証（ローカル）。

対象: public/_headers を実際に適用する配信面（wrangler dev = Workers Assets ローカル、
      もしくは デプロイ済みURL）。
やること: 各ページを読み込み、CSP違反/JSエラーを収集し、機能が生きているかをセンチネルで確認する。

使い方:
    python3 scripts/security-csp-check.py http://127.0.0.1:8788
    python3 scripts/security-csp-check.py https://www.ai-ustyle.co.jp   # 公開後の実測
"""
import json
import sys

from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8788").rstrip("/")

CASES = [
    {
        "path": "/",
        "name": "トップ",
        "expect_csp": "strict",
        "action": "mousemove",  # main.js のマウス追従カーソルが動くかで JS 実行を確認する
        "sentinel": """(() => {
            const dot = document.getElementById('cursorDot');
            const chat = document.querySelector('[data-ustyle-chat]');
            return {
                main_js_ran: !!dot && dot.style.left !== '',
                three_loaded: typeof window.THREE !== 'undefined',
                gsap_loaded: typeof window.gsap !== 'undefined',
                chat_present: !!chat,
                sections: document.querySelectorAll('section').length,
            };
        })()""",
        "assert": lambda r: r["main_js_ran"] and r["three_loaded"] and r["gsap_loaded"] and r["chat_present"] and r["sections"] >= 5,
    },
    {
        "path": "/pricing.html",
        "name": "料金",
        "expect_csp": "strict",
        "sentinel": """(() => {
            const back = document.getElementById('pricingBack');
            const line = document.querySelector('a.btn-line[href*="lin.ee"]');
            return { back_present: !!back, line_cta: !!line, plans: document.querySelectorAll('.plan, .pricing-card, .price-card').length };
        })()""",
        "assert": lambda r: r["back_present"] and r["line_cta"],
    },
    {
        "path": "/company.html",
        "name": "会社概要",
        "expect_csp": "strict",
        "sentinel": "(() => ({ tables: document.querySelectorAll('table, .info-list, .company-table').length, text_len: document.body.innerText.length }))()",
        "assert": lambda r: r["text_len"] > 500,
    },
    {
        "path": "/usecase-ebay.html",
        "name": "導入事例",
        "expect_csp": "strict",
        "sentinel": "(() => ({ images: document.querySelectorAll('img').length, text_len: document.body.innerText.length }))()",
        "assert": lambda r: r["images"] > 0 and r["text_len"] > 500,
    },
    {
        "path": "/test/ai/",
        "name": "事務作業まるなげLP",
        "expect_csp": "loose",
        "sentinel": """(() => {
            const roots = document.querySelectorAll('[data-mn-chat]');
            const bound = Array.from(roots).filter(r => r.dataset.mnBound === '1').length;
            return {
                widget_js_ran: bound > 0,
                widget_count: roots.length,
                runtime_replaced: document.querySelectorAll('x-import').length === 0,
                images: document.querySelectorAll('img').length,
                gtag: typeof window.gtag !== 'undefined',
                text_len: document.body.innerText.length,
            };
        })()""",
        "assert": lambda r: r["widget_js_ran"] and r["text_len"] > 1000,
    },
    {
        "path": "/transportation/",
        "name": "AI配車係デモ",
        "expect_csp": "strict",
        "sentinel": """(() => {
            const root = document.getElementById('root') || document.querySelector('#app');
            return { react_rendered: !!root && root.children.length > 0, text_len: document.body.innerText.length };
        })()""",
        "assert": lambda r: r["react_rendered"] and r["text_len"] > 500,
    },
]

report = {"base": BASE, "results": []}
failures = []

with sync_playwright() as p:
    def _launch():
        # インストール済みブラウザのリビジョンと playwright パッケージの期待値がずれている場合は
        # キャッシュ内の実体を executable_path で明示指定する（skill: local-frontend-verification）。
        import glob
        import os

        candidates = (
            sorted(glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-*/chrome-headless-shell")))
            + sorted(glob.glob(os.path.expanduser("~/Library/Caches/ms-playwright/chromium-*/chrome-mac-*/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")))
            + ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
        )
        try:
            return p.chromium.launch(headless=True)
        except Exception:
            for candidate in candidates:
                if os.path.exists(candidate):
                    return p.chromium.launch(headless=True, executable_path=candidate)
            raise

    browser = _launch()

    for case in CASES:
        violations, errors, failed_requests = [], [], []
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        page.on("console", lambda msg: (
            violations.append(msg.text) if "content security policy" in msg.text.lower() or "refused to" in msg.text.lower() else None
        ))
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("requestfailed", lambda req: failed_requests.append(f"{req.url} :: {req.failure}"))

        url = f"{BASE}{case['path']}"
        response = page.goto(url, wait_until="load", timeout=45000)
        page.wait_for_timeout(1200)
        if case.get("action") == "mousemove":
            page.mouse.move(520, 420)
            page.wait_for_timeout(400)
        sentinel = page.evaluate(case["sentinel"])
        csp_header = (response.header_value("content-security-policy") if response else None) or ""

        entry = {
            "path": case["path"],
            "status": response.status if response else None,
            "csp_present": bool(csp_header),
            "csp_has_unsafe_eval": "'unsafe-eval'" in csp_header,
            "csp_violations": violations,
            "page_errors": errors,
            "failed_requests": [f for f in failed_requests if "cdn-cgi" not in f and "favicon" not in f],
            "sentinel": sentinel,
        }
        # 期待するCSP種別（/test/ai だけ unsafe-eval を持つ緩和版）
        csp_ok = entry["csp_present"] and (
            entry["csp_has_unsafe_eval"] if case["expect_csp"] == "loose" else not entry["csp_has_unsafe_eval"]
        )
        entry["csp_kind_ok"] = csp_ok
        entry["sentinel_ok"] = bool(case["assert"](sentinel))
        entry["pass"] = csp_ok and entry["sentinel_ok"] and not violations and not errors
        report["results"].append(entry)
        if not entry["pass"]:
            failures.append(entry["path"])
        context.close()

    browser.close()

report["pass"] = not failures
report["failures"] = failures
print(json.dumps(report, ensure_ascii=False, indent=2))
sys.exit(0 if report["pass"] else 1)
