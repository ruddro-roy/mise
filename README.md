# Mise

Live dinner-party studio for the [WebMCP Challenge](https://webmcp.devpost.com/). Source lives at [github.com/ruddro-roy/mise](https://github.com/ruddro-roy/mise).

Deploy on **ChatGPT Sites**, not GitHub Pages. Open the production URL in ChatGPT's in-app browser so you and the agent share one table.

Each visit opens a **live party** (`/p/{id}`) on the Sites D1 database. The host, a roommate, and ChatGPT can use the same link. WebMCP tools mutate that record. Confirmation-gated writes wait on whoever is at the table.

## Host on ChatGPT Sites

Sites is OpenAI's host for this hackathon. It runs a Cloudflare Workers-compatible app with D1 for durable data.

From the ChatGPT desktop app or [chatgpt.com/sites](https://chatgpt.com/sites):

```
@Sites Deploy https://github.com/ruddro-roy/mise, a live WebMCP dinner-party studio.
Use the D1 binding named DB from .openai/hosting.json. Make the Site public so
judges can open the URL in ChatGPT's in-app browser. Give me the production URL.
```

Then set the Site public and submit that URL on Devpost.

Required Sites files (already in this repo):

- `.openai/hosting.json` — `"d1": "DB"`
- `db/schema.ts` — Drizzle schema for live parties
- `drizzle/` — generated migrations (`npm run db:generate`)

Sites fills in `project_id` after it provisions the project. Do not put secrets in that file.

In ChatGPT's browser: use GPT-5.6 Sol or Terra (Luna has WebMCP off). Open **Site tools** in the address bar to see Mise's tools.

## Why this is a WebMCP problem

Hosting is unpaid production work. The hard part starts when two people are vegan, one cannot sit next to another, the budget is $90, and dinner is Saturday.

A backend MCP server could invent a menu in chat. It would not share the seating chart on screen, would not pause for you to lock the pasta, and would not reuse the catalog already in the page. WebMCP keeps the human interface in the loop: tools run in the open page, the studio updates live, and `lock_menu` / `send_invites` wait on a dialog only the host can finish.

## How WebMCP is implemented

- Feature-detect `document.modelContext`. ChatGPT Sites and the in-app browser use native WebMCP. Other browsers get a spec-faithful polyfill (`registerTool`, `getTools`, `executeTool`, `toolchange`, `AbortSignal`).
- Tools register on the **top-level page** (ChatGPT does not discover iframe tools).
- Core write tools stay registered so an agent that never clicks a panel can still act.
- Read-only lens tools come and go with the open panel.
- Tool results are JSON strings.
- The live party API (`/api/parties`) is the source of truth. The agent still goes through WebMCP; the page persists what the tools changed.

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

- Plan Saturday dinner for 8 — two vegan, Maya has a nut allergy, $90, Italian, warm and unfussy
- Seat Maya away from Tom and put the two vegans together
- Swap the pasta for something gluten-free and rebuild the market list
- Build a 4-hour run of show starting at 7pm, then lock the menu
- Draft invites and send them

## Stack

Vite, React, Hono Worker, D1, Tailwind, shadcn/ui, WebMCP. MIT licensed.
