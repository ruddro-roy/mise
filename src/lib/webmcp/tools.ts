import { findDishTemplates, getDishByCatalogId } from "@/lib/domain/catalog";
import { normalizeAllergen } from "@/lib/domain/diet";
import { createId } from "@/lib/domain/ids";
import {
  analyzeMenu,
  autoSeat,
  buildRunOfShow,
  buildShoppingList,
  draftInvites,
  instantiateDish,
  proposeMenu,
  seatingIssues,
  substituteDish,
} from "@/lib/domain/planner";
import { studioSnapshot, useStudioStore } from "@/lib/domain/store";
import type { Diet, EventBrief, Guest, Panel, Rsvp } from "@/lib/domain/types";
import type { JsonSchema, ToolDefinition } from "./types";

function result(data: unknown): string {
  return JSON.stringify(data);
}

function log(tool: string, summary: string) {
  useStudioStore.getState().appendLog({ tool, summary, source: "agent" });
}

function assertUnlocked() {
  if (useStudioStore.getState().menuLocked) {
    throw new Error("The menu is locked. Ask the host to unlock it before changing dishes.");
  }
}

const emptySchema: JsonSchema = { type: "object", properties: {} };

function guestFromInput(input: Record<string, unknown>, existing?: Guest): Guest {
  const allergens = Array.isArray(input.allergens)
    ? input.allergens.map((item) => normalizeAllergen(String(item)))
    : existing?.allergens ?? [];
  return {
    id: existing?.id ?? createId("guest"),
    name: String(input.name ?? existing?.name ?? "Guest"),
    diet: (String(input.diet ?? existing?.diet ?? "omnivore") as Diet) || "omnivore",
    allergens,
    avoidSeatWith: existing?.avoidSeatWith ?? [],
    preferSeatWith: existing?.preferSeatWith ?? [],
    rsvp: (String(input.rsvp ?? existing?.rsvp ?? "yes") as Rsvp) || "yes",
    notes: String(input.notes ?? existing?.notes ?? ""),
  };
}

function findGuest(name: string): Guest | undefined {
  const needle = name.toLowerCase();
  return useStudioStore
    .getState()
    .guests.find((guest) => guest.name.toLowerCase() === needle);
}

export const CORE_TOOLS: ToolDefinition[] = [
  {
    name: "get_workspace_state",
    title: "Read the table",
    description:
      "Read the current dinner: brief, guests, menu, seating, market list, run of show, lock state, and analysis. Use this before acting.",
    inputSchema: emptySchema,
    annotations: { readOnlyHint: true },
    execute() {
      const state = studioSnapshot();
      const analysis = analyzeMenu(state.dishes, state.guests, state.brief.budgetUsd);
      const seats = seatingIssues(state.table.seats, state.guests);
      return result({
        ok: true,
        panel: state.panel,
        menuLocked: state.menuLocked,
        invitesSent: state.invitesSent,
        brief: state.brief,
        guests: state.guests,
        dishes: state.dishes.map((dish) => ({
          id: dish.id,
          name: dish.name,
          course: dish.course,
          diet: dish.diet,
          allergens: dish.allergens,
          servings: dish.servings,
        })),
        table: state.table,
        marketCount: state.market.length,
        timelineCount: state.timeline.length,
        analysis,
        seatingIssues: seats,
      });
    },
  },
  {
    name: "focus_panel",
    title: "Show a studio panel",
    description:
      "Move the host's view to a studio panel so they can watch the change. Panels: brief, guests, menu, seating, market, run.",
    inputSchema: {
      type: "object",
      properties: {
        panel: {
          type: "string",
          enum: ["brief", "guests", "menu", "seating", "market", "run"],
          description: "Which panel the host should see.",
        },
      },
      required: ["panel"],
    },
    execute(input) {
      const panel = String(input.panel) as Panel;
      useStudioStore.getState().setPanel(panel);
      log("focus_panel", `Opened the ${panel} panel.`);
      return result({ ok: true, panel });
    },
  },
  {
    name: "set_event_brief",
    title: "Set the brief",
    description:
      "Set the dinner brief: title, date (YYYY-MM-DD), start time (HH:mm), guest count, budget in USD, cuisine, vibe, and notes.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "ISO date YYYY-MM-DD" },
        startTime: { type: "string", description: "24h time HH:mm" },
        guestCount: { type: "number" },
        budgetUsd: { type: "number" },
        cuisine: { type: "string" },
        vibe: { type: "string" },
        notes: { type: "string" },
      },
    },
    execute(input) {
      const patch: Record<string, unknown> = {};
      for (const key of [
        "title",
        "date",
        "startTime",
        "guestCount",
        "budgetUsd",
        "cuisine",
        "vibe",
        "notes",
      ] as const) {
        if (input[key] !== undefined) patch[key] = input[key];
      }
      useStudioStore.getState().patchBrief(patch as Partial<EventBrief>);
      useStudioStore.getState().setPanel("brief");
      log("set_event_brief", "Updated the night's brief.");
      return result({ ok: true, brief: useStudioStore.getState().brief });
    },
  },
  {
    name: "add_guest",
    title: "Add a guest",
    description:
      "Add someone to the table. Include diet (omnivore, vegetarian, vegan, pescatarian) and allergens (nuts, gluten, dairy, ...).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        diet: { type: "string", enum: ["omnivore", "vegetarian", "vegan", "pescatarian"] },
        allergens: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
        rsvp: { type: "string", enum: ["yes", "maybe", "no", "unknown"] },
      },
      required: ["name"],
    },
    execute(input) {
      const existing = findGuest(String(input.name));
      const guest = guestFromInput(input, existing);
      useStudioStore.getState().upsertGuest(guest);
      useStudioStore.getState().setPanel("guests");
      log("add_guest", `Seated ${guest.name} on the list.`);
      return result({ ok: true, guest });
    },
  },
  {
    name: "update_guest",
    title: "Update a guest",
    description:
      "Update a guest by name. Can change diet, allergens, notes, RSVP, or who they should or should not sit beside.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        diet: { type: "string" },
        allergens: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
        rsvp: { type: "string" },
        avoidSeatWith: {
          type: "string",
          description: "Name of a guest they should not sit beside.",
        },
        preferSeatWith: {
          type: "string",
          description: "Name of a guest they should sit beside.",
        },
      },
      required: ["name"],
    },
    execute(input) {
      const existing = findGuest(String(input.name));
      if (!existing) return result({ ok: false, error: `No guest named ${input.name}.` });
      const guest = guestFromInput(input, existing);
      if (typeof input.avoidSeatWith === "string") {
        const other = findGuest(input.avoidSeatWith);
        if (other && !guest.avoidSeatWith.includes(other.id)) {
          guest.avoidSeatWith = [...guest.avoidSeatWith, other.id];
        }
      }
      if (typeof input.preferSeatWith === "string") {
        const other = findGuest(input.preferSeatWith);
        if (other && !guest.preferSeatWith.includes(other.id)) {
          guest.preferSeatWith = [...guest.preferSeatWith, other.id];
        }
      }
      useStudioStore.getState().upsertGuest(guest);
      useStudioStore.getState().setPanel("guests");
      log("update_guest", `Updated ${guest.name}.`);
      return result({ ok: true, guest });
    },
  },
  {
    name: "remove_guest",
    title: "Remove a guest",
    description: "Remove a guest from the list by name.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    execute(input) {
      const existing = findGuest(String(input.name));
      if (!existing) return result({ ok: false, error: `No guest named ${input.name}.` });
      useStudioStore.getState().removeGuest(existing.id);
      log("remove_guest", `Removed ${existing.name}.`);
      return result({ ok: true });
    },
  },
  {
    name: "propose_menu",
    title: "Propose a menu",
    description:
      "Replace the menu with a constraint-aware proposal from the house catalog. Respects guest diets, family-style allergens, cuisine, and budget.",
    inputSchema: {
      type: "object",
      properties: {
        cuisine: { type: "string" },
        guestCount: { type: "number" },
        budgetUsd: { type: "number" },
        extraAllergens: { type: "array", items: { type: "string" } },
      },
    },
    execute(input) {
      assertUnlocked();
      const state = useStudioStore.getState();
      const cuisine = String(input.cuisine ?? state.brief.cuisine ?? "italian");
      const guestCount = Number(input.guestCount ?? state.brief.guestCount ?? state.guests.length ?? 6);
      const budgetUsd =
        input.budgetUsd !== undefined
          ? Number(input.budgetUsd)
          : state.brief.budgetUsd;
      const extraAllergens = Array.isArray(input.extraAllergens)
        ? input.extraAllergens.map((item) => normalizeAllergen(String(item)))
        : [];
      const proposed = proposeMenu({
        cuisine,
        guestCount,
        budgetUsd,
        guests: state.guests,
        extraAllergens,
      });
      state.setDishes(proposed.dishes);
      state.patchBrief({ cuisine, guestCount, budgetUsd });
      state.setPanel("menu");
      log("propose_menu", `Wrote a ${cuisine} menu with ${proposed.dishes.length} dishes.`);
      return result({
        ok: true,
        rationale: proposed.rationale,
        warnings: proposed.warnings,
        dishes: proposed.dishes.map((dish) => dish.name),
        analysis: analyzeMenu(proposed.dishes, state.guests, budgetUsd),
      });
    },
  },
  {
    name: "add_dish",
    title: "Add a dish",
    description:
      "Add a dish from the house catalog by name or catalog id. Optionally set servings.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        servings: { type: "number" },
      },
      required: ["name"],
    },
    execute(input) {
      assertUnlocked();
      const name = String(input.name);
      const template =
        getDishByCatalogId(name) ?? findDishTemplates(name)[0];
      if (!template) return result({ ok: false, error: `No catalog dish matching "${name}".` });
      const servings = Number(
        input.servings ?? useStudioStore.getState().brief.guestCount ?? 6,
      );
      const dish = instantiateDish(template, servings);
      useStudioStore.getState().upsertDish(dish);
      useStudioStore.getState().setPanel("menu");
      log("add_dish", `Added ${dish.name}.`);
      return result({ ok: true, dish: { id: dish.id, name: dish.name, course: dish.course } });
    },
  },
  {
    name: "remove_dish",
    title: "Remove a dish",
    description: "Remove a menu dish by name.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    execute(input) {
      assertUnlocked();
      const needle = String(input.name).toLowerCase();
      const dish = useStudioStore
        .getState()
        .dishes.find((item) => item.name.toLowerCase().includes(needle));
      if (!dish) return result({ ok: false, error: `No dish matching "${input.name}".` });
      useStudioStore.getState().removeDish(dish.id);
      log("remove_dish", `Took ${dish.name} off the menu.`);
      return result({ ok: true, removed: dish.name });
    },
  },
  {
    name: "substitute_dish",
    title: "Substitute a dish",
    description:
      "Replace a menu dish with a catalog stand-in that matches a constraint such as gluten-free, vegan, or cheaper.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Current dish to replace." },
        constraint: {
          type: "string",
          description: "What the replacement must satisfy, e.g. gluten-free.",
        },
      },
      required: ["name", "constraint"],
    },
    execute(input) {
      assertUnlocked();
      const state = useStudioStore.getState();
      const swapped = substituteDish(
        state.dishes,
        String(input.name),
        String(input.constraint),
        state.brief.guestCount || state.guests.length || 6,
        state.guests,
      );
      if (swapped.error) return result({ ok: false, error: swapped.error });
      state.setDishes(swapped.dishes);
      state.setPanel("menu");
      log(
        "substitute_dish",
        `Swapped ${swapped.replaced?.name} for ${swapped.added?.name}.`,
      );
      return result({
        ok: true,
        replaced: swapped.replaced?.name,
        added: swapped.added?.name,
      });
    },
  },
  {
    name: "generate_shopping_list",
    title: "Build the market list",
    description:
      "Rebuild the shopping list from the current menu. Pantry staples are omitted. Replaces the existing list.",
    inputSchema: emptySchema,
    execute() {
      const state = useStudioStore.getState();
      const market = buildShoppingList(state.dishes);
      state.setMarket(market);
      state.setPanel("market");
      log("generate_shopping_list", `Wrote ${market.length} market lines.`);
      return result({
        ok: true,
        items: market.length,
        estimatedCost: Number(market.reduce((sum, item) => sum + item.estimatedCost, 0).toFixed(2)),
      });
    },
  },
  {
    name: "check_market_item",
    title: "Check a market item",
    description: "Mark a shopping-list item bought or still needed, by name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        checked: { type: "boolean" },
      },
      required: ["name"],
    },
    execute(input) {
      const needle = String(input.name).toLowerCase();
      const item = useStudioStore
        .getState()
        .market.find((row) => row.name.toLowerCase().includes(needle));
      if (!item) return result({ ok: false, error: `No market line matching "${input.name}".` });
      useStudioStore.getState().toggleMarket(item.id, Boolean(input.checked ?? true));
      return result({ ok: true, name: item.name, checked: input.checked ?? true });
    },
  },
  {
    name: "add_market_item",
    title: "Add a market item",
    description: "Add a custom line to the shopping list.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        qty: { type: "number" },
        unit: { type: "string" },
        estimatedCost: { type: "number" },
        aisle: { type: "string" },
      },
      required: ["name"],
    },
    execute(input) {
      const item = {
        id: createId("mkt"),
        name: String(input.name),
        qty: Number(input.qty ?? 1),
        unit: String(input.unit ?? "each"),
        estimatedCost: Number(input.estimatedCost ?? 0),
        aisle: String(input.aisle ?? "other"),
        checked: false,
        forDishes: [],
      };
      useStudioStore.getState().upsertMarket(item);
      useStudioStore.getState().setPanel("market");
      log("add_market_item", `Added ${item.name} to the market list.`);
      return result({ ok: true, item });
    },
  },
  {
    name: "set_table_shape",
    title: "Set the table shape",
    description: "Choose a round or rectangle table before seating.",
    inputSchema: {
      type: "object",
      properties: { shape: { type: "string", enum: ["round", "rectangle"] } },
      required: ["shape"],
    },
    execute(input) {
      const shape = input.shape === "rectangle" ? "rectangle" : "round";
      useStudioStore.getState().setTableShape(shape);
      return result({ ok: true, shape });
    },
  },
  {
    name: "link_guests_by_diet",
    title: "Sit a diet together",
    description:
      "Mark every guest with the given diet as preferring to sit beside each other, then leave seating to auto_seat.",
    inputSchema: {
      type: "object",
      properties: {
        diet: { type: "string", enum: ["vegan", "vegetarian", "pescatarian", "omnivore"] },
      },
      required: ["diet"],
    },
    execute(input) {
      const diet = String(input.diet) as Diet;
      const state = useStudioStore.getState();
      const group = state.guests.filter((guest) => guest.diet === diet);
      for (const guest of group) {
        const others = group.filter((other) => other.id !== guest.id).map((other) => other.id);
        state.upsertGuest({
          ...guest,
          preferSeatWith: [...new Set([...guest.preferSeatWith, ...others])],
        });
      }
      state.setPanel("seating");
      log("link_guests_by_diet", `Asked the ${diet} guests to sit together.`);
      return result({ ok: true, linked: group.map((guest) => guest.name) });
    },
  },
  {
    name: "auto_seat",
    title: "Seat the table",
    description:
      "Seat every RSVP'd guest using avoid/prefer constraints. Replaces the current chart.",
    inputSchema: emptySchema,
    execute() {
      const state = useStudioStore.getState();
      const seats = autoSeat(state.guests, state.table.shape);
      state.setSeats(seats);
      state.setPanel("seating");
      log("auto_seat", `Sat ${seats.filter((seat) => seat.guestId).length} people.`);
      return result({
        ok: true,
        seats,
        issues: seatingIssues(seats, state.guests),
      });
    },
  },
  {
    name: "assign_seat",
    title: "Assign a seat",
    description: "Place a guest in a seat index (0-based). Moves them if they already have a chair.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        index: { type: "number" },
      },
      required: ["name", "index"],
    },
    execute(input) {
      const guest = findGuest(String(input.name));
      if (!guest) return result({ ok: false, error: `No guest named ${input.name}.` });
      useStudioStore.getState().assignSeat(Number(input.index), guest.id);
      useStudioStore.getState().setPanel("seating");
      log("assign_seat", `Put ${guest.name} in seat ${input.index}.`);
      return result({ ok: true });
    },
  },
  {
    name: "swap_seats",
    title: "Swap two seats",
    description: "Swap two guests by name.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "string" },
      },
      required: ["a", "b"],
    },
    execute(input) {
      const state = useStudioStore.getState();
      const a = findGuest(String(input.a));
      const b = findGuest(String(input.b));
      if (!a || !b) return result({ ok: false, error: "Both names must already be on the list." });
      const seats = state.table.seats.map((seat) => {
        if (seat.guestId === a.id) return { ...seat, guestId: b.id };
        if (seat.guestId === b.id) return { ...seat, guestId: a.id };
        return seat;
      });
      state.setSeats(seats);
      state.setPanel("seating");
      log("swap_seats", `Swapped ${a.name} and ${b.name}.`);
      return result({ ok: true, issues: seatingIssues(seats, state.guests) });
    },
  },
  {
    name: "generate_run_of_show",
    title: "Build the run of show",
    description:
      "Write a day-of timeline working backward from dinner start. hours is the prep window, default 4.",
    inputSchema: {
      type: "object",
      properties: {
        hours: { type: "number", description: "Hours of prep before sit-down." },
      },
    },
    execute(input) {
      const state = useStudioStore.getState();
      const hours = Number(input.hours ?? 4);
      const timeline = buildRunOfShow(state.dishes, state.brief.startTime, hours);
      state.setTimeline(timeline);
      state.setPanel("run");
      log("generate_run_of_show", `Wrote a ${hours}-hour run of show.`);
      return result({ ok: true, steps: timeline.length, hours });
    },
  },
  {
    name: "add_timeline_step",
    title: "Add a timeline step",
    description:
      "Add a custom run-of-show step. offsetMinutes is relative to sit-down; negative is before.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        detail: { type: "string" },
        offsetMinutes: { type: "number" },
        owner: { type: "string", enum: ["host", "agent", "guest"] },
      },
      required: ["title"],
    },
    execute(input) {
      const step = {
        id: createId("step"),
        title: String(input.title),
        detail: String(input.detail ?? ""),
        offsetMinutes: Number(input.offsetMinutes ?? -30),
        owner: (String(input.owner ?? "host") as "host" | "agent" | "guest") || "host",
      };
      useStudioStore.getState().addTimelineStep(step);
      useStudioStore.getState().setPanel("run");
      log("add_timeline_step", `Added “${step.title}” to the run of show.`);
      return result({ ok: true, step });
    },
  },
  {
    name: "lock_menu",
    title: "Lock the menu",
    description:
      "Ask the host to lock the menu. The tool waits for an on-page confirmation. After lock, dishes cannot change until unlock_menu.",
    inputSchema: emptySchema,
    async execute() {
      if (useStudioStore.getState().menuLocked) {
        return result({ ok: true, alreadyLocked: true, locked: true });
      }
      const names =
        useStudioStore.getState().dishes.map((dish) => dish.name).join(", ") || "an empty menu";
      const approved = await useStudioStore.getState().requestApproval({
        tool: "lock_menu",
        title: "Lock this menu?",
        body: `The agent wants to freeze ${names}. You can still shop and seat. Unlock later if the pasta rebellion wins.`,
        confirmLabel: "Lock the menu",
      });
      if (!approved) return result({ ok: false, error: "The host declined to lock the menu." });
      const store = useStudioStore.getState();
      store.setMenuLocked(true);
      store.setPanel("menu");
      log("lock_menu", "Menu locked by the host.");
      return result({ ok: true, locked: true });
    },
  },
  {
    name: "unlock_menu",
    title: "Unlock the menu",
    description: "Unlock the menu so dishes can change again.",
    inputSchema: emptySchema,
    execute() {
      useStudioStore.getState().setMenuLocked(false);
      log("unlock_menu", "Menu unlocked.");
      return result({ ok: true, locked: false });
    },
  },
  {
    name: "send_invites",
    title: "Send invites",
    description:
      "Draft invite copy from the current brief and menu, then wait for the host to approve sending. This is a confirmation-gated write.",
    inputSchema: emptySchema,
    async execute() {
      const state = useStudioStore.getState();
      const copy = draftInvites({
        title: state.brief.title,
        date: state.brief.date,
        startTime: state.brief.startTime,
        vibe: state.brief.vibe,
        dishes: state.dishes,
        guests: state.guests,
      });
      const approved = await state.requestApproval({
        tool: "send_invites",
        title: "Send these invites?",
        body: copy,
        confirmLabel: "Send invites",
      });
      if (!approved) return result({ ok: false, error: "The host kept the invites unsent." });
      state.setInvitesSent(true);
      log("send_invites", "Invites sent.");
      return result({ ok: true, sent: true, copy });
    },
  },
  {
    name: "load_sample_party",
    title: "Load the sample Saturday",
    description:
      "Replace the workspace with the sample Saturday Italian dinner: eight guests, diets, seating politics, and a starter menu.",
    inputSchema: emptySchema,
    execute() {
      useStudioStore.getState().loadSample();
      log("load_sample_party", "Loaded the sample Saturday table.");
      return result({ ok: true, title: useStudioStore.getState().brief.title });
    },
  },
  {
    name: "reset_workspace",
    title: "Clear the table",
    description: "Ask the host to wipe the workspace. Waits for confirmation.",
    inputSchema: emptySchema,
    async execute() {
      const approved = await useStudioStore.getState().requestApproval({
        tool: "reset_workspace",
        title: "Clear the whole table?",
        body: "This throws out the brief, guests, menu, seats, market list, and run of show.",
        confirmLabel: "Clear everything",
      });
      if (!approved) return result({ ok: false, error: "The host kept the table." });
      useStudioStore.getState().reset();
      log("reset_workspace", "Workspace cleared.");
      return result({ ok: true });
    },
  },
];

export function lensTools(panel: Panel): ToolDefinition[] {
  if (panel === "menu") {
    return [
      {
        name: "explain_menu_gaps",
        title: "Explain the menu",
        description:
          "Read-only analysis of the current menu: diet coverage, allergens, missing courses, and budget.",
        inputSchema: emptySchema,
        annotations: { readOnlyHint: true },
        execute() {
          const state = studioSnapshot();
          return result({
            ok: true,
            analysis: analyzeMenu(state.dishes, state.guests, state.brief.budgetUsd),
            dishes: state.dishes.map((dish) => ({
              name: dish.name,
              course: dish.course,
              diet: dish.diet,
              allergens: dish.allergens,
            })),
          });
        },
      },
    ];
  }
  if (panel === "seating") {
    return [
      {
        name: "explain_seating",
        title: "Explain the seating",
        description:
          "Read-only walk through the current seating chart, neighbor pairs, and unmet avoid/prefer rules.",
        inputSchema: emptySchema,
        annotations: { readOnlyHint: true },
        execute() {
          const state = studioSnapshot();
          const names = new Map(state.guests.map((guest) => [guest.id, guest.name]));
          return result({
            ok: true,
            shape: state.table.shape,
            seats: state.table.seats.map((seat) => ({
              index: seat.index,
              guest: seat.guestId ? names.get(seat.guestId) ?? null : null,
            })),
            issues: seatingIssues(state.table.seats, state.guests),
          });
        },
      },
    ];
  }
  if (panel === "market") {
    return [
      {
        name: "explain_market",
        title: "Explain the market list",
        description:
          "Read-only summary of remaining cost, unchecked items, and aisle groups.",
        inputSchema: emptySchema,
        annotations: { readOnlyHint: true },
        execute() {
          const state = studioSnapshot();
          const remaining = state.market.filter((item) => !item.checked);
          return result({
            ok: true,
            remainingItems: remaining.length,
            remainingCost: Number(
              remaining.reduce((sum, item) => sum + item.estimatedCost, 0).toFixed(2),
            ),
            aisles: [...new Set(state.market.map((item) => item.aisle))],
          });
        },
      },
    ];
  }
  return [];
}
