# Demo script

Target: one take, under 3 minutes, recorded against the live site in ChatGPT's in-app browser. Every line below is either something you say or something you do. No improvisation.

Setup before recording: ChatGPT on GPT-5.6 Sol or Terra (Luna has WebMCP off). Close other tabs. Have https://mise-studio.ruddro-roy.chatgpt.site ready to paste.

## Beats

0:00 Hook. Say: "This is Mise. It plans a dinner party with you on one shared table. The page publishes its own tools, so the agent works the same screen you do." Open the site root in ChatGPT's in-app browser. The studio paints. Point at the header badge: "Native WebMCP. No plugin, no server, no install."

0:20 Tool discovery. Open Site tools in the ChatGPT address bar. Scroll the list. Say: "The page registers about 25 tools on document.modelContext. ChatGPT found them by loading the page. lock_menu, add_guest, get_workspace_state, all live."

0:40 The plan. Type to ChatGPT: "Plan Saturday dinner for 8. Two guests are vegan. Maya has a nut allergy. Budget is $90. Italian, warm and unfussy." Stay quiet while it runs. As panels fill, narrate: "Brief, guests, menu, market list, seating. Each of those was a tool call. The studio is the tool output."

1:20 A human constraint. Type: "Seat Maya away from Tom and put the two vegans together." When the seating chart moves, say: "The agent cannot see grudges. I can. Same table, both of us editing it."

1:40 A swap. Type: "Swap the pasta for something gluten-free and rebuild the market list." Say: "It swapped inside the catalog and the shopping list followed. Nothing invented."

2:00 The gate. Type: "Book it." A confirmation dialog opens in the page. Say: "lock_menu is destructive, so the page makes the human finish it. The agent asked. I decide." Click confirm. The Menu locked badge appears.

2:20 Persistence. Click Copy live link. Refresh the page. Say: "The party lives at /p/ plus an id in D1. Refresh, reopen, send the link to a roommate. Same table."

2:40 Close. Say: "Mise is WebMCP as it is meant to be used. The page owns the tools, the agent uses them, the human holds the gate. Repo at github.com/ruddro-roy/mise." End recording.

## If a beat fails on camera

- Badge says polyfill: you are not in ChatGPT's in-app browser, or the model is Luna. Reopen on Sol or Terra.
- Site tools list is empty: refresh the page once, then reopen Site tools.
- The plan stalls: type "What's the plan?" to force a state read, then continue from the beat you were on.
