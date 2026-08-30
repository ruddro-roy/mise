# Mise, Devpost submission copy

## What it is

Mise is a dinner-party planning studio that shares one live table with a ChatGPT agent. The host opens the site, the agent opens the same page inside ChatGPT, and both work the same record: brief, guest list, menu, seating chart, market list, and run of show. The party lives at a `/p/{id}` link backed by D1 on ChatGPT Sites. Anyone with the link edits the same party. There are no accounts.

Live site: https://mise-studio.ruddro-roy.chatgpt.site
Repo: https://github.com/ruddro-roy/mise (MIT licensed)

## How WebMCP is used

The page defines 28 tools for `document.modelContext`: 25 always-on tools plus 3 contextual read lenses that appear on the menu, seating, or market panel. Source: https://github.com/ruddro-roy/mise/blob/main/src/lib/webmcp/tools.ts

The tools are the app, not decoration. `set_event_brief`, `add_guest`, `propose_menu`, `substitute_dish`, `auto_seat`, `generate_shopping_list`, and `generate_run_of_show` write the state the studio renders. Read tools like `get_workspace_state` and the per-panel lens tools give the agent the same view the human has. Destructive tools, `lock_menu` and `send_invites`, open a confirmation dialog in the page. The agent can ask, only the host can finish.

In ChatGPT's in-app browser the tools appear under Site tools in the address bar, native WebMCP, nothing installed. In other browsers a polyfill implements the same contract so the in-page Sous-chef demo works everywhere. Concurrent writes are handled: a save that lost a race gets a 409 and retries once against the latest record.

Mise also publishes an optional remote MCP server at https://mise-studio.ruddro-roy.chatgpt.site/mcp. This is a separate protocol surface, not a substitute for the WebMCP entry. It lets judges add Mise to ChatGPT Developer mode and use 13 focused tools against the exact same D1 party. The hybrid design makes the distinction visible: WebMCP owns the live, human-gated page experience; remote MCP makes the shared workspace installable.

## How to judge it

1. Open https://mise-studio.ruddro-roy.chatgpt.site in ChatGPT's in-app browser on GPT-5.6 Sol or Terra. Luna has WebMCP off.
2. Check the header badge reads Native WebMCP and open Site tools to see the tool list.
3. Ask ChatGPT: "Plan Saturday dinner for 8. Two guests are vegan. Maya has a nut allergy. Budget is $90. Italian, warm and unfussy." Watch the panels fill as the tools run.
4. Say "book it". The page opens a confirmation dialog. Confirm it and the menu locks.
5. Refresh. The `/p/{id}` party and its state persist.

Optional installability check: add `https://mise-studio.ruddro-roy.chatgpt.site/mcp` as a remote MCP server in ChatGPT Developer mode, run `create_party`, and open the returned share URL. No environment variable or authentication is required.

The README judge path covers the same steps: https://github.com/ruddro-roy/mise/blob/main/README.md#for-judges

## What's next

Three things, in order. First, RSVP links so guests answer the invite on their phone and the seating chart updates from their answer. Second, a bigger dish catalog with per-store pricing so the market list carries real totals. Third, multi-party memory, so the agent can reuse what worked from the last dinner when it plans the next one.
