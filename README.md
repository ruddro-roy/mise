# Mise

Live dinner-party studio for the [WebMCP Challenge](https://webmcp.devpost.com/). Source lives at [github.com/ruddro-roy/mise](https://github.com/ruddro-roy/mise).

Host this app on ChatGPT Sites. Sites runs a Cloudflare Workers-compatible app with D1. Do not use GitHub Pages.

Each visit opens a live party at `/p/{id}` on the Sites D1 database. The host, a roommate, and ChatGPT can share the same link. WebMCP tools mutate that record. Confirmation-gated writes wait on whoever is at the table.

## Host on ChatGPT Sites

Production URL will go here after Sites deploy.

Required files already in this repo:

- `.openai/hosting.json` has `"d1": "DB"`.
- `db/schema.ts` is the Drizzle schema for live parties.
- `drizzle/` holds generated migrations. Run `npm run db:generate` when the schema changes.

Sites fills in `project_id` after it provisions the project. Do not put secrets in that file.

Use GPT-5.6 Sol or Terra in ChatGPT's browser. Luna has WebMCP off. Open **Site tools** in the address bar to see Mise's tools.

When the production URL is live, open it in ChatGPT's in-app browser so you and the agent share one table.

## Why this is a WebMCP problem

Hosting is unpaid production work. The hard part starts when two people are vegan, one cannot sit next to another, the budget is $90, and dinner is Saturday.

A backend MCP server could invent a menu in chat. It would miss the seating chart on screen. It would not pause so you can lock the pasta. It would not reuse the catalog already in the page.

WebMCP tools run in the open page. The studio updates as they run. `lock_menu` and `send_invites` wait on a dialog only the host can finish.

## How WebMCP is implemented

The page detects `document.modelContext`. ChatGPT Sites and the in-app browser use native WebMCP. Other browsers get a polyfill that implements `registerTool`, `getTools`, `executeTool`, `toolchange`, and `AbortSignal`.

Tools register on the top-level page. ChatGPT does not discover iframe tools.

Core write tools stay registered so an agent that never clicks a panel can still act. Read-only lens tools come and go with the open panel. Tool results are JSON strings.

The live party API at `/api/parties` stores the current party. The agent still goes through WebMCP. The page persists what the tools changed.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43417](http://127.0.0.1:43417). The app creates a live party and puts its id in the URL.

```bash
npm test
npm run build
```

Local preview uses an in-memory party store. ChatGPT Sites uses D1.

## Suggested prompts (in ChatGPT, on the live URL)

- Plan Saturday dinner for 8. Two guests are vegan. Maya has a nut allergy. Budget is $90. Italian, warm and unfussy.
- Seat Maya away from Tom and put the two vegans together.
- Swap the pasta for something gluten-free and rebuild the market list.
- Build a 4-hour run of show starting at 7pm, then lock the menu.
- Draft invites and send them.

## Stack

Vite, React, Hono Worker, D1, Tailwind, shadcn/ui, WebMCP. MIT licensed.
