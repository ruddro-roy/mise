# Mise

Live dinner-party studio for the [WebMCP Challenge](https://webmcp.devpost.com/). Source lives at [github.com/ruddro-roy/mise](https://github.com/ruddro-roy/mise).

Host this app on ChatGPT Sites. Sites runs a Cloudflare Workers-compatible app with D1. Do not use GitHub Pages.

Each visit opens a live party at `/p/{id}` on the Sites D1 database. The host, a roommate, and ChatGPT can share the same link. Native WebMCP tools and the optional remote MCP server mutate that same record. Confirmation-gated browser writes wait on whoever is at the table.

## Host on ChatGPT Sites

Production URL: [mise-studio.ruddro-roy.chatgpt.site](https://mise-studio.ruddro-roy.chatgpt.site)

Required files already in this repo:

- `.openai/hosting.json` has `"d1": "DB"`.
- `db/schema.ts` is the Drizzle schema for live parties.
- `drizzle/` holds generated migrations. Run `npm run db:generate` when the schema changes.

Sites fills in `project_id` after it provisions the project. Do not put secrets in that file.

No environment variables are required. Sites provides the D1 database through the `DB` binding in `.openai/hosting.json`.

Use GPT-5.6 Sol or Terra in ChatGPT's browser. Luna has WebMCP off. Open **Site tools** in the address bar to see Mise's tools.

When the production URL is live, open it in ChatGPT's in-app browser so you and the agent share one table.

## For judges

Mise has two deliberate agent surfaces over the same live party:

- **Native WebMCP**, the challenge path. The published page registers 25 always-on tools plus 3 contextual read lenses. ChatGPT discovers them through **Site tools** when the URL is open in ChatGPT's in-app browser. Nothing needs to be installed.
- **Remote MCP**, the optional installable path. A standards-compliant Streamable HTTP server is published at `https://mise-studio.ruddro-roy.chatgpt.site/mcp`. It exposes 13 focused tools and writes the same D1 party records.

WebMCP and remote MCP are different protocols. Mise supports both; the WebMCP implementation is the hackathon entry.

The share-link model: every party is a row in D1 keyed by the id in `/p/{id}`. Opening the site root creates a fresh party and puts its id in the URL. Anyone with the link, including ChatGPT, edits the same record. There are no accounts and no sessions. Writes carry the last `updatedAt` the client saw; a stale write gets a 409 and retries once against the latest record. The **New party** button in the header opens a clean table when you want one.

1. Open [mise-studio.ruddro-roy.chatgpt.site](https://mise-studio.ruddro-roy.chatgpt.site) inside ChatGPT (GPT-5.6 Sol or Terra; Luna has WebMCP off).
2. Confirm the header badge says **Native WebMCP**, not polyfill.
3. Open **Site tools** and check for core tools such as `lock_menu`, `add_guest`, and `get_workspace_state` (25 always on; one of 3 additional read lenses appears on its matching panel).
4. Ask ChatGPT to plan a Saturday dinner and lock the menu. `lock_menu` should open a confirmation dialog in the page before the menu locks.
5. Refresh. The party id in `/p/{id}` and the saved state should still be there (D1 on Sites).

### Add the remote MCP server to ChatGPT

1. Enable **Developer mode** in ChatGPT under **Settings → Security and login**.
2. Open **Plugins**, select **+**, and create a plugin from a remote MCP server.
3. Enter `https://mise-studio.ruddro-roy.chatgpt.site/mcp` as the MCP server URL. No authentication or environment variable is required.
4. Review the 13 tools, then create a party with `create_party` or give ChatGPT an existing `/p/{id}` share link.
5. Open the returned share URL. Changes made through the plugin appear in the same studio.

The server supports the current MCP protocol and the legacy stateless Streamable HTTP flow used by older clients. Tool schemas, structured output, read/write annotations, CORS, and persistent D1 writes are covered by protocol tests.

The **Sous-chef** panel is an in-page demo. It uses the same tools but runs through the polyfill in a normal browser. Hackathon scoring follows native WebMCP in ChatGPT's browser, not the Sous-chef badge alone.

## Why the challenge entry is WebMCP

Hosting is unpaid production work. The hard part starts when two people are vegan, one cannot sit next to another, the budget is $90, and dinner is Saturday.

A remote MCP server alone would miss the seating chart on screen and could not pause inside the page so the host can lock the pasta. That is why native WebMCP remains the primary experience.

WebMCP tools run in the open page. The studio updates as they run. `lock_menu` and `send_invites` wait on a dialog only the host can finish.

## How WebMCP is implemented

The page detects `document.modelContext`. ChatGPT Sites and the in-app browser use native WebMCP. Other browsers get a polyfill that implements `registerTool`, `getTools`, `executeTool`, `toolchange`, and `AbortSignal`.

Tools register on the top-level page. ChatGPT does not discover iframe tools.

Core write tools stay registered so an agent that never clicks a panel can still act. Read-only lens tools come and go with the open panel. Tool results are JSON strings.

The live party API at `/api/parties` stores the current party. The native agent goes through WebMCP and the optional plugin goes through `/mcp`; both persist the same workspace.

## How remote MCP is implemented

`src/lib/mcp/server.ts` uses the official TypeScript MCP SDK and a fetch-native Streamable HTTP handler compatible with Cloudflare Workers. Its tools cover party creation and reading, brief and guest updates, seating constraints, catalog-grounded menus and substitutions, shopping lists, timelines, menu locks, invite drafts, and catalog search.

The endpoint is public because Mise uses unguessable share links rather than accounts. No tool sends messages or purchases anything. Invitation generation is draft-only, and mutating tools carry MCP safety annotations.

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

Local preview uses an in-memory party store. ChatGPT Sites uses D1. The local MCP endpoint is `http://127.0.0.1:43417/mcp`.

## Suggested prompts (in ChatGPT, on the live URL)

- Plan Saturday dinner for 8. Two guests are vegan. Maya has a nut allergy. Budget is $90. Italian, warm and unfussy.
- Seat Maya away from Tom and put the two vegans together.
- Swap the pasta for something gluten-free and rebuild the market list.
- Build a 4-hour run of show starting at 7pm, then lock the menu.
- Draft invites and send them.

## Stack

Vite, React, Hono Worker, D1, Tailwind, shadcn/ui, native WebMCP, and the official MCP TypeScript SDK. MIT licensed.
