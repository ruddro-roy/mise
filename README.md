# Mise

Live dinner-party studio for the [WebMCP Challenge](https://webmcp.devpost.com/). Source lives at [github.com/ruddro-roy/mise](https://github.com/ruddro-roy/mise).

Host this app on ChatGPT Sites. Sites runs a Cloudflare Workers-compatible app with D1. Do not use GitHub Pages.

Each visit opens a live party at `/p/{id}` on the Sites D1 database. The host, a roommate, and ChatGPT can share the same link. WebMCP tools mutate that record. Confirmation-gated writes wait on whoever is at the table.

## Host on ChatGPT Sites

Production URL: [mise-studio.ruddro-roy.chatgpt.site](https://mise-studio.ruddro-roy.chatgpt.site)

Required files already in this repo:

- `.openai/hosting.json` has `"d1": "DB"`.
- `db/schema.ts` is the Drizzle schema for live parties.
- `drizzle/` holds generated migrations. Run `npm run db:generate` when the schema changes.

Sites fills in `project_id` after it provisions the project. Do not put secrets in that file.

Use GPT-5.6 Sol or Terra in ChatGPT's browser. Luna has WebMCP off. Open **Site tools** in the address bar to see Mise's tools.

When the production URL is live, open it in ChatGPT's in-app browser so you and the agent share one table.

## For judges

Mise is **WebMCP**, not a ChatGPT MCP plugin or a separate MCP server. You do not install anything. The published Site page registers tools on `document.modelContext`. ChatGPT discovers them through **Site tools** in the address bar when the URL is open in ChatGPT's in-app browser.

The share-link model: every party is a row in D1 keyed by the id in `/p/{id}`. Opening the site root creates a fresh party and puts its id in the URL. Anyone with the link, including ChatGPT, edits the same record. There are no accounts and no sessions. Writes carry the last `updatedAt` the client saw; a stale write gets a 409 and retries once against the latest record. The **New party** button in the header opens a clean table when you want one.

1. Open [mise-studio.ruddro-roy.chatgpt.site](https://mise-studio.ruddro-roy.chatgpt.site) inside ChatGPT (GPT-5.6 Sol or Terra; Luna has WebMCP off).
2. Confirm the header badge says **Native WebMCP**, not polyfill.
3. Open **Site tools** and check for core tools such as `lock_menu`, `add_guest`, and `get_workspace_state` (25 core tools; 3 more lens tools register while their panel is open).
4. Ask ChatGPT to plan a Saturday dinner and lock the menu. `lock_menu` should open a confirmation dialog in the page before the menu locks.
5. Refresh. The party id in `/p/{id}` and the saved state should still be there (D1 on Sites).

The **Sous-chef** panel is an in-page demo. It uses the same tools but runs through the polyfill in a normal browser. Hackathon scoring follows native WebMCP in ChatGPT's browser, not the Sous-chef badge alone.

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
