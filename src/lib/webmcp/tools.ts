import { z } from "zod";
import type { AppState } from "@/lib/live-store";
import { getState, patchState, resetState } from "@/lib/live-store";
import {
  analyzeMenu,
  autoSeat,
  buildRunOfShow,
  buildShoppingList,
  dishEstimatedCost,
  draftInvites,
  instantiateDish,
  proposeMenu,
  seatingIssues,
  substituteDish,
} from "@/lib/domain/planner";
import { ALLERGEN_LABELS, DISH_CATALOG, type AllergenId } from "@/lib/domain/catalog";
import type { Guest, MenuItem, Seat, ShoppingList, TimelineEvent } from "@/lib/domain/types";
import { uid } from "@/lib/id";

export type WebMcpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
};

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (args: unknown) => Promise<WebMcpToolResult>;
};

function ok(text: string, extra?: Record<string, unknown>): WebMcpToolResult {
  const payload = { ok: true, ...extra };
  return {
    content: [{ type: "text", text }],
    structuredContent: payload,
  };
}

function fail(message: string): WebMcpToolResult {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: { ok: false, error: message },
  };
}

function parseAllergens(raw: string[] | undefined): AllergenId[] {
  if (!raw?.length) return [];
  return raw.filter((id): id is AllergenId => id in ALLERGEN_LABELS);
}

function nextSeatNumber(seats: Seat[], tableId: string): number {
  const taken = new Set(seats.filter((seat) => seat.tableId === tableId).map((seat) => seat.number));
  let n = 1;
  while (taken.has(n)) n += 1;
  return n;
}

function snapshot() {
  const state = getState();
  return {
    party: state.party,
    guestCount: state.guests.length,
    menuCount: state.menu.length,
    listCount: state.lists.length,
    timelineCount: state.timeline.length,
    lastAction: state.lastAction,
  };
}

function brief() {
  const state = getState();
  const issues = analyzeMenu(state.menu, state.guests);
  const seatIssues = seatingIssues(state.seats, state.guests);
  const estimatedTotal = state.menu.reduce((sum, dish) => sum + dishEstimatedCost(dish, state.party.guestCount), 0);
  return {
    party: state.party,
    guests: state.guests,
    menu: state.menu,
    seats: state.seats,
    lists: state.lists,
    timeline: state.timeline,
    invites: state.invites,
    issues,
    seatIssues,
    estimatedTotal,
  };
}

function requirePartyName(state: AppState) {
  if (!state.party.name.trim()) {
    throw new Error("Set a party name first with set_party.");
  }
}

export const tools: WebMcpTool[] = [
  {
    name: "get_party_brief",
    description: "Read the current dinner party: guests, menu, seating issues, shopping lists, and run-of-show.",
    inputSchema: z.object({}),
    async execute() {
      return ok("Party brief ready.", { brief: brief() });
    },
  },
  {
    name: "set_party",
    description: "Create or update the party brief: name, date, time, venue, guest count, budget, and vibe.",
    inputSchema: z.object({
      name: z.string().min(1),
      date: z.string().optional(),
      time: z.string().optional(),
      venue: z.string().optional(),
      guestCount: z.number().int().min(1).max(24).optional(),
      budgetPerGuest: z.number().min(8).max(200).optional(),
      vibe: z.string().optional(),
    }),
    async execute(raw) {
      const args = raw as {
        name: string;
        date?: string;
        time?: string;
        venue?: string;
        guestCount?: number;
        budgetPerGuest?: number;
        vibe?: string;
      };
      const next = patchState((state) => {
        state.party = {
          ...state.party,
          name: args.name,
          date: args.date?.trim() || state.party.date,
          time: args.time?.trim() || state.party.time,
          venue: args.venue?.trim() || state.party.venue,
          guestCount: args.guestCount ?? state.party.guestCount,
          budgetPerGuest: args.budgetPerGuest ?? state.party.budgetPerGuest,
          vibe: args.vibe?.trim() || state.party.vibe,
        };
      });
      return ok(`Party set: ${next.party.name}.`, { party: next.party, snapshot: snapshot() });
    },
  },
  {
    name: "add_guest",
    description: "Add one guest with dietary notes, allergies, and optional seating preferences.",
    inputSchema: z.object({
      name: z.string().min(1),
      email: z.string().optional(),
      diet: z.enum(["omnivore", "vegetarian", "vegan", "pescatarian"]).optional(),
      allergies: z.array(z.string()).optional(),
      notes: z.string().optional(),
      avoid: z.string().optional(),
    }),
    async execute(raw) {
      const args = raw as {
        name: string;
        email?: string;
        diet?: Guest["diet"];
        allergies?: string[];
        notes?: string;
        avoid?: string;
      };
      const next = patchState((state) => {
        requirePartyName(state);
        const guest: Guest = {
          id: uid("guest"),
          name: args.name.trim(),
          email: args.email?.trim() || undefined,
          diet: args.diet ?? "omnivore",
          allergies: parseAllergens(args.allergies),
          notes: args.notes?.trim() || undefined,
          avoid: args.avoid?.trim() || undefined,
        };
        state.guests.push(guest);
        state.party.guestCount = Math.max(state.party.guestCount, state.guests.length);
      });
      return ok(`Added guest ${args.name}.`, { guests: next.guests, snapshot: snapshot() });
    },
  },
  {
    name: "update_guest",
    description: "Update an existing guest by id.",
    inputSchema: z.object({
      guestId: z.string().min(1),
      name: z.string().optional(),
      email: z.string().optional(),
      diet: z.enum(["omnivore", "vegetarian", "vegan", "pescatarian"]).optional(),
      allergies: z.array(z.string()).optional(),
      notes: z.string().optional(),
      avoid: z.string().optional(),
    }),
    async execute(raw) {
      const args = raw as {
        guestId: string;
        name?: string;
        email?: string;
        diet?: Guest["diet"];
        allergies?: string[];
        notes?: string;
        avoid?: string;
      };
      let found = false;
      const next = patchState((state) => {
        const guest = state.guests.find((item) => item.id === args.guestId);
        if (!guest) return;
        found = true;
        if (args.name) guest.name = args.name.trim();
        if (args.email !== undefined) guest.email = args.email.trim() || undefined;
        if (args.diet) guest.diet = args.diet;
        if (args.allergies) guest.allergies = parseAllergens(args.allergies);
        if (args.notes !== undefined) guest.notes = args.notes.trim() || undefined;
        if (args.avoid !== undefined) guest.avoid = args.avoid.trim() || undefined;
      });
      if (!found) return fail(`Guest ${args.guestId} was not found.`);
      return ok("Guest updated.", { guests: next.guests, snapshot: snapshot() });
    },
  },
  {
    name: "remove_guest",
    description: "Remove a guest and clear their seat.",
    inputSchema: z.object({
      guestId: z.string().min(1),
    }),
    async execute(raw) {
      const args = raw as { guestId: string };
      const next = patchState((state) => {
        state.guests = state.guests.filter((guest) => guest.id !== args.guestId);
        for (const seat of state.seats) {
          if (seat.guestId === args.guestId) seat.guestId = null;
        }
      });
      return ok("Guest removed.", { guests: next.guests, seats: next.seats, snapshot: snapshot() });
    },
  },
  {
    name: "propose_menu",
    description: "Generate a course-balanced dinner menu from the catalog that respects diets, allergies, and budget.",
    inputSchema: z.object({
      guestCount: z.number().int().min(1).max(24).optional(),
      budgetPerGuest: z.number().min(8).max(200).optional(),
      vibe: z.string().optional(),
    }),
    async execute(raw) {
      const args = raw as { guestCount?: number; budgetPerGuest?: number; vibe?: string };
      const next = patchState((state) => {
        requirePartyName(state);
        if (args.guestCount) state.party.guestCount = args.guestCount;
        if (args.budgetPerGuest) state.party.budgetPerGuest = args.budgetPerGuest;
        if (args.vibe?.trim()) state.party.vibe = args.vibe.trim();
        state.menu = proposeMenu({
          guests: state.guests,
          guestCount: state.party.guestCount,
          budgetPerGuest: state.party.budgetPerGuest,
          vibe: state.party.vibe,
        });
        state.lists = [];
      });
      return ok(`Proposed a ${next.menu.length}-course menu.`, {
        menu: next.menu,
        issues: analyzeMenu(next.menu, next.guests),
        snapshot: snapshot(),
      });
    },
  },
  {
    name: "add_dish",
    description: "Add a named dish from the catalog, or a custom dish with ingredients.",
    inputSchema: z.object({
      catalogId: z.string().optional(),
      title: z.string().optional(),
      course: z.enum(["starter", "main", "side", "dessert", "drink"]).optional(),
      ingredients: z.array(z.string()).optional(),
    }),
    async execute(raw) {
      const args = raw as {
        catalogId?: string;
        title?: string;
        course?: MenuItem["course"];
        ingredients?: string[];
      };
      if (args.catalogId) {
        const dish = DISH_CATALOG.find((item) => item.id === args.catalogId);
        if (!dish) return fail(`Catalog dish ${args.catalogId} was not found.`);
        const next = patchState((state) => {
          requirePartyName(state);
          state.menu.push(instantiateDish(dish));
          state.lists = [];
        });
        return ok(`Added ${dish.title}.`, { menu: next.menu, snapshot: snapshot() });
      }
      if (!args.title || !args.course) {
        return fail("Provide catalogId, or both title and course.");
      }
      const next = patchState((state) => {
        requirePartyName(state);
        state.menu.push({
          id: uid("dish"),
          title: args.title!.trim(),
          course: args.course!,
          diet: "omnivore",
          allergens: [],
          servings: state.party.guestCount,
          costPerGuest: 12,
          prepMinutes: 25,
          ingredients: (args.ingredients ?? ["custom ingredients"]).map((name) => ({
            name,
            qty: 1,
            unit: "item",
            aisle: "other" as const,
          })),
        });
        state.lists = [];
      });
      return ok(`Added custom dish ${args.title}.`, { menu: next.menu, snapshot: snapshot() });
    },
  },
  {
    name: "remove_dish",
    description: "Remove a dish from the menu.",
    inputSchema: z.object({
      dishId: z.string().min(1),
    }),
    async execute(raw) {
      const args = raw as { dishId: string };
      const next = patchState((state) => {
        state.menu = state.menu.filter((dish) => dish.id !== args.dishId);
        state.lists = [];
      });
      return ok("Dish removed.", { menu: next.menu, snapshot: snapshot() });
    },
  },
  {
    name: "substitute_dish",
    description: "Replace a dish with a safer catalog option that respects guest diets and allergies.",
    inputSchema: z.object({
      dishId: z.string().min(1),
    }),
    async execute(raw) {
      const args = raw as { dishId: string };
      let replacement: MenuItem | null = null;
      let originalTitle = "";
      const next = patchState((state) => {
        const current = state.menu.find((dish) => dish.id === args.dishId);
        if (!current) return;
        originalTitle = current.title;
        replacement = substituteDish(current, state.guests);
        state.menu = state.menu.map((dish) => (dish.id === args.dishId ? replacement! : dish));
        state.lists = [];
      });
      if (!replacement) return fail(`Dish ${args.dishId} was not found or could not be substituted.`);
      return ok(`Substituted ${originalTitle} with ${replacement.title}.`, {
        menu: next.menu,
        issues: analyzeMenu(next.menu, next.guests),
        snapshot: snapshot(),
      });
    },
  },
  {
    name: "analyze_menu",
    description: "Score the current menu against diets, allergies, budget, and leftover risk.",
    inputSchema: z.object({}),
    async execute() {
      const state = getState();
      return ok("Menu analysis ready.", {
        issues: analyzeMenu(state.menu, state.guests),
        estimatedTotal: state.menu.reduce((sum, dish) => sum + dishEstimatedCost(dish, state.party.guestCount), 0),
        snapshot: snapshot(),
      });
    },
  },
  {
    name: "auto_seat",
    description: "Assign seats so allergies and avoid-notes are not stacked next to each other.",
    inputSchema: z.object({
      tables: z.number().int().min(1).max(4).optional(),
    }),
    async execute(raw) {
      const args = raw as { tables?: number };
      const next = patchState((state) => {
        requirePartyName(state);
        state.seats = autoSeat(state.guests, args.tables ?? 1);
      });
      return ok(`Seated ${next.guests.length} guests.`, {
        seats: next.seats,
        issues: seatingIssues(next.seats, next.guests),
        snapshot: snapshot(),
      });
    },
  },
  {
    name: "assign_seat",
    description: "Manually assign a guest to a table and seat number.",
    inputSchema: z.object({
      guestId: z.string().min(1),
      tableId: z.string().min(1),
      number: z.number().int().min(1).max(16).optional(),
    }),
    async execute(raw) {
      const args = raw as { guestId: string; tableId: string; number?: number };
      const next = patchState((state) => {
        const guest = state.guests.find((item) => item.id === args.guestId);
        if (!guest) throw new Error(`Guest ${args.guestId} was not found.`);
        const existing = state.seats.find((seat) => seat.guestId === args.guestId);
        if (existing) {
          existing.tableId = args.tableId;
          if (args.number) existing.number = args.number;
          return;
        }
        state.seats.push({
          id: uid("seat"),
          tableId: args.tableId,
          number: args.number ?? nextSeatNumber(state.seats, args.tableId),
          guestId: args.guestId,
        });
      });
      return ok("Seat assigned.", {
        seats: next.seats,
        issues: seatingIssues(next.seats, next.guests),
        snapshot: snapshot(),
      });
    },
  },
  {
    name: "build_shopping_list",
    description: "Roll the menu into a market list grouped by aisle, scaled to guest count.",
    inputSchema: z.object({
      store: z.string().optional(),
    }),
    async execute(raw) {
      const args = raw as { store?: string };
      let list: ShoppingList | null = null;
      const next = patchState((state) => {
        requirePartyName(state);
        if (!state.menu.length) throw new Error("Add a menu before building a shopping list.");
        list = buildShoppingList(state.menu, state.party.guestCount, args.store?.trim() || "Neighborhood market");
        const idx = state.lists.findIndex((item) => item.store === list!.store);
        if (idx >= 0) state.lists[idx] = list;
        else state.lists.push(list);
      });
      return ok(`Shopping list ready for ${list?.store}.`, { lists: next.lists, snapshot: snapshot() });
    },
  },
  {
    name: "toggle_list_item",
    description: "Check or uncheck one shopping-list item.",
    inputSchema: z.object({
      listId: z.string().min(1),
      itemId: z.string().min(1),
      checked: z.boolean(),
    }),
    async execute(raw) {
      const args = raw as { listId: string; itemId: string; checked: boolean };
      const next = patchState((state) => {
        const list = state.lists.find((item) => item.id === args.listId);
        const item = list?.items.find((row) => row.id === args.itemId);
        if (item) item.checked = args.checked;
      });
      return ok(args.checked ? "Item checked." : "Item unchecked.", { lists: next.lists, snapshot: snapshot() });
    },
  },
  {
    name: "build_run_of_show",
    description: "Build a timed prep and service timeline from the current menu and party start time.",
    inputSchema: z.object({}),
    async execute() {
      let timeline: TimelineEvent[] = [];
      const next = patchState((state) => {
        requirePartyName(state);
        if (!state.menu.length) throw new Error("Add a menu before building a run-of-show.");
        timeline = buildRunOfShow(state.menu, state.party.time || "19:00");
        state.timeline = timeline;
      });
      return ok(`Run-of-show has ${timeline.length} beats.`, { timeline: next.timeline, snapshot: snapshot() });
    },
  },
  {
    name: "draft_invites",
    description: "Draft invite copy for every guest who has an email.",
    inputSchema: z.object({}),
    async execute() {
      const next = patchState((state) => {
        requirePartyName(state);
        state.invites = draftInvites(state.party, state.guests);
      });
      return ok(`Drafted ${next.invites.length} invites.`, { invites: next.invites, snapshot: snapshot() });
    },
  },
  {
    name: "reset_party",
    description: "Clear the current party and start over.",
    inputSchema: z.object({}),
    async execute() {
      resetState();
      return ok("Party reset.", { snapshot: snapshot() });
    },
  },
];
