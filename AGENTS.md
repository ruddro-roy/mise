# Mise agent notes

Mise is a Vite + React app with a Hono Worker backend, D1 persistence on ChatGPT Sites, and WebMCP tools on the top-level page.

## Hosting

- Deploy on **ChatGPT Sites** with the D1 binding `DB` from `.openai/hosting.json`.
- Do not add GitHub Pages, Vercel, or static-site deploy workflows.
- Local dev uses in-memory party storage; production uses Sites D1.

## WebMCP

- Register tools on the top-level page via `document.modelContext`.
- ChatGPT does not discover tools in iframes.
- Confirmation-gated writes (`lock_menu`, `send_invites`) need human approval in the UI.
- Tool results are JSON strings.

## Stack

Vite, React 19, Hono, Drizzle + D1, Tailwind, shadcn/ui. Run `npm test` and `npm run build` before landing substantive changes.
