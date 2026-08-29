---
name: ruddro-mode
description: "Ruddro Roy's agent style: concise technical prose, ChatGPT Sites hosting, WebMCP-first product work, architect planning, loop-until-done autonomy. Use for ruddro, ruddro-roy, /ruddro-mode, or requests to work in their style."
disable-model-invocation: true
---

# Ruddro mode

Working conventions for Ruddro Roy (ruddro-roy, roy@ruddro.com). Invoke explicitly; do not auto-trigger on generic tasks.

## Response style

Write like a short technical blog post. Complete sentences, plain words, one idea per sentence.

- Keep replies proportional to task size. A small fix gets a short answer.
- Cite existing code with fenced blocks: `startLine:endLine:filepath` on its own line. Skip big irrelevant chunks with `...`.
- Use markdown links for URLs and paths. Do not shorten or elide them.
- Apply the **unslop** skill to every prose surface, including this reply.
- Skip decorative bold and backticks. Use them only when they add meaning.
- No chatbot closers ("Let me know if...", "I hope this helps!").
- No em dashes. End the sentence or use a comma.

## Autonomy

Proceed on reversible work without asking. Run commands and use MCP tools in this real environment. Do not simulate or tell the user to run steps you can run yourself.

When the user says multitask, loop until done, or `/loop until X`, keep going until the stated condition holds. Use the **loop** command flow (subscription timer on cloud agents). Pair long autonomous runs with **poteto-mode** rigor where the task warrants it.

Pause before irreversible actions: force-push to shared branches, production deploys, data deletion, customer-facing messages.

For architecture forks or code crossing module boundaries, read and follow the **architect** skill before implementing. For "how does this work" or placement questions, use the **how** skill.

## Product and hosting (Mise / WebMCP Challenge)

This repo is **Mise**, a live dinner-party studio for the WebMCP Challenge. Treat these as fixed constraints unless the user overrides them in chat.

- Host on **ChatGPT Sites** with D1 (`DB` binding). The submission needs a live dynamic app judges can open in ChatGPT's in-app browser.
- Do **not** add GitHub Pages, Vercel, or static-site deploy workflows. The user has pushed back hard on Pages-style hosting for this hackathon project.
- WebMCP tools register on the top-level page via `document.modelContext`. Writes that need human approval stay confirmation-gated (`lock_menu`, `send_invites`, and similar).
- Local preview uses in-memory storage. Production persistence is Sites D1. See `README.md` for the `@Sites` deploy prompt.

## Verification

"Done" means the real artifact works, not that it compiles.

- For UI and WebMCP behavior, verify against the live or local app when you can.
- Run `npm test` and `npm run build` before landing substantive code changes.
- For hackathon demo work, the bar is a working Sites URL with tools visible in ChatGPT's in-app browser (Site tools in the address bar; GPT-5.6 Sol or Terra).

## Process

**New Project sessions (default here):** commit and push to `main`. Open a PR only when the user explicitly asks.

**Commits:** author as `Ruddro Roy <roy@ruddro.com>` only. No `Co-authored-by` or other AI attribution trailers.

**Code changes:** smallest correct diff. Match surrounding conventions. No drive-by refactors. Comments only for non-obvious why.

## Skills to reach for

| Situation | Skill |
|-----------|-------|
| Any prose | **unslop** |
| Rigor, playbooks, subagents, shipping discipline | **poteto-mode** |
| Cross-boundary or contested design | **architect** |
| Runtime behavior, ownership, "where should this live" | **how** |
| Design rationale, regressions, "why this way" | **why** |
| Recurring or until-done work | **loop** command + **poteto-mode** autonomous-run playbook when scope is large |
| Authoring or refreshing this mode skill | **automate-me** |

Reference skills by path. Do not paste their full contents into replies or into this file.

## Subagents

Use subagents for parallel investigation, transcript mining, or large read-only scans. Keep summaries in the main thread.

Default to background tasks when fanning out. You own every delegate's output: review the diff and write your own summary.

For code-writing delegates inside poteto playbooks, follow **poteto-mode** subagent defaults (`poteto-agent`, model tiers, `run_in_background: true`).
