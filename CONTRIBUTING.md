# Contributing

Mise is a Vite + React app with a Hono Worker backend. Production persists live parties in ChatGPT Sites D1. WebMCP tools register on the top-level page.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:43417. The app creates a live party and puts its id in the URL.

Run `npm test` and `npm run build` before you push.

Local preview stores parties in memory. ChatGPT Sites stores them in D1.

## Stack

Vite, React 19, Hono, Drizzle + D1, Tailwind, and shadcn/ui.

## Host on ChatGPT Sites

To deploy, use ChatGPT Sites. Skip GitHub Pages, Vercel, and static-site workflows.

Keep the D1 binding in `.openai/hosting.json` as `DB`. The live-party schema is `db/schema.ts`. Generated migrations live in `drizzle/`. When you change the schema, run `npm run db:generate`.

Sites fills in `project_id` after it provisions the project. Leave secrets out of that file.

## Register WebMCP tools

Register tools on the top-level page through `document.modelContext`. ChatGPT does not discover tools in iframes.

`lock_menu` and `send_invites` wait for a person to confirm in the UI. Tool results are JSON strings.
