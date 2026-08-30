import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { findDishTemplates } from "../domain/catalog";
import { normalizeAllergen } from "../domain/diet";
import { createId } from "../domain/ids";
import {
  analyzeMenu,
  autoSeat,
  buildRunOfShow,
  buildShoppingList,
  draftInvites,
  proposeMenu,
  seatingIssues,
  substituteDish,
} from "../domain/planner";
import { emptyWorkspace, sampleWorkspace } from "../domain/sample";
import type { Diet, Guest, Rsvp, TableShape, Workspace } from "../domain/types";
import { sanitizeWorkspace } from "../live/schema";
import type { PartyRecord, PartyStore } from "../live/types";

const PRODUCTION_HOST = "mise-studio.ruddro-roy.chatgpt.site";
const partyRef = z
  .string()
  .min(6)
  .describe("Party id or full Mise share URL, such as /p/abc123def4.");
const outputSchema = z
  .object({
    ok: z.boolean(),
    party_id: z.string().optional(),
    url: z.string().optional(),
    error: z.string().optional(),
  })
  .catchall(z.unknown());

type PartyMutation<T> = {
  record: PartyRecord;
  result: T;
};

export type PartyService = {
  create: (sample: boolean) => Promise<PartyRecord>;
  get: (id: string) => Promise<PartyRecord | null>;
  update: <T>(
    id: string,
    mutate: (workspace: Workspace) => T | Promise<T>,
  ) => Promise<PartyMutation<T> | null>;
};

export function createPartyService(
  store: PartyStore,
  createPartyId: () => string,
  withWriteLock: <T>(id: string, work: () => Promise<T>) => Promise<T>,
): PartyService {
  return {
    async create(sample) {
      const now = Date.now();
      const record = {
        id: createPartyId(),
        workspace: sample ? sampleWorkspace() : emptyWorkspace(),
        updatedAt: now,
        createdAt: now,
      };
      await store.put(record);
      return record;
    },
    get: (id) => store.get(id),
    update(id, mutate) {
      return withWriteLock(id, async () => {
        const existing = await store.get(id);
        if (!existing) return null;
        const workspace = structuredClone(existing.workspace);
        const result = await mutate(workspace);
        const record = {
          ...existing,
          workspace: sanitizeWorkspace(workspace),
          updatedAt: Math.max(Date.now(), existing.updatedAt + 1),
        };
        await store.put(record);
        return { record, result };
      });
    },
  };
}

function parsePartyId(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/p\/([^/]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // A bare party id is expected most of the time.
  }
  return trimmed.replace(/^\/p\//, "").split(/[/?#]/)[0];
}

function partyUrl(origin: string, id: string): string {
  return `${origin}/p/${encodeURIComponent(id)}`;
}

function appendLog(workspace: Workspace, tool: string, summary: string) {
  workspace.log = [
    ...workspace.log,
    { id: createId("log"), at: Date.now(), tool, summary, source: "agent" as const },
  ].slice(-60);
}

function result(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data,
    ...(data.ok === false ? { isError: true } : {}),
  };
}

function missingParty(id: string) {
  return result({
    ok: false,
    party_id: id,
    error: `Party ${id} was not found. Use create_party or provide a valid Mise share URL.`,
  });
}

function guestFromInput(
  input: {
    name: string;
    diet?: Diet;
    allergens?: string[];
    notes?: string;
    rsvp?: Rsvp;
  },
  existing?: Guest,
): Guest {
  return {
    id: existing?.id ?? createId("guest"),
    name: input.name.trim(),
    diet: input.diet ?? existing?.diet ?? "omnivore",
    allergens:
      input.allergens?.map((item) => normalizeAllergen(item)) ?? existing?.allergens ?? [],
    avoidSeatWith: existing?.avoidSeatWith ?? [],
    preferSeatWith: existing?.preferSeatWith ?? [],
    rsvp: input.rsvp ?? existing?.rsvp ?? "yes",
    notes: input.notes ?? existing?.notes ?? "",
  };
}

function createMiseMcpServer(service: PartyService, origin: string) {
  const server = new McpServer(
    { name: "mise-party-studio", version: "1.0.0" },
    {
      instructions:
        "Mise plans a shared dinner party. Start with create_party or ask for a Mise share URL. Read the party before writes. Return the updated share URL after every write. Respect menu lock state and never claim invites were externally delivered.",
    },
  );

  server.registerTool(
    "create_party",
    {
      title: "Create a Mise party",
      description:
        "Create a persistent party and return its share URL. Use sample=true for a judge-ready Saturday dinner.",
      inputSchema: z.object({ sample: z.boolean().optional().default(false) }),
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ sample }) => {
      const record = await service.create(sample);
      return result({
        ok: true,
        party_id: record.id,
        url: partyUrl(origin, record.id),
        sample,
        brief: record.workspace.brief,
      });
    },
  );

  server.registerTool(
    "get_party",
    {
      title: "Read a Mise party",
      description:
        "Read the full shared party state, including brief, guests, menu, seating, market list, timeline, and constraints.",
      inputSchema: z.object({ party_id: partyRef }),
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ party_id }) => {
      const id = parsePartyId(party_id);
      const record = await service.get(id);
      if (!record) return missingParty(id);
      const workspace = record.workspace;
      return result({
        ok: true,
        party_id: id,
        url: partyUrl(origin, id),
        updated_at: record.updatedAt,
        workspace,
        menu_analysis: analyzeMenu(
          workspace.dishes,
          workspace.guests,
          workspace.brief.budgetUsd,
        ),
        seating_issues: seatingIssues(workspace.table.seats, workspace.guests),
      });
    },
  );

  server.registerTool(
    "set_event_brief",
    {
      title: "Set the event brief",
      description:
        "Update the date, time, budget, cuisine, vibe, title, guest count, or notes for a shared Mise party.",
      inputSchema: z.object({
        party_id: partyRef,
        title: z.string().optional(),
        date: z.string().nullable().optional(),
        start_time: z.string().nullable().optional(),
        guest_count: z.number().int().min(0).max(100).optional(),
        budget_usd: z.number().min(0).nullable().optional(),
        cuisine: z.string().optional(),
        vibe: z.string().optional(),
        notes: z.string().optional(),
      }),
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ party_id, ...patch }) => {
      const id = parsePartyId(party_id);
      const updated = await service.update(id, (workspace) => {
        if (patch.title !== undefined) workspace.brief.title = patch.title;
        if (patch.date !== undefined) workspace.brief.date = patch.date;
        if (patch.start_time !== undefined) workspace.brief.startTime = patch.start_time;
        if (patch.guest_count !== undefined) workspace.brief.guestCount = patch.guest_count;
        if (patch.budget_usd !== undefined) workspace.brief.budgetUsd = patch.budget_usd;
        if (patch.cuisine !== undefined) workspace.brief.cuisine = patch.cuisine;
        if (patch.vibe !== undefined) workspace.brief.vibe = patch.vibe;
        if (patch.notes !== undefined) workspace.brief.notes = patch.notes;
        workspace.panel = "brief";
        appendLog(workspace, "set_event_brief", "Updated the event brief through MCP.");
        return workspace.brief;
      });
      if (!updated) return missingParty(id);
      return result({
        ok: true,
        party_id: id,
        url: partyUrl(origin, id),
        brief: updated.result,
        updated_at: updated.record.updatedAt,
      });
    },
  );

  server.registerTool(
    "upsert_guest",
    {
      title: "Add or update a guest",
      description:
        "Add a guest by name or update the existing matching guest, including diet, allergens, RSVP, and notes.",
      inputSchema: z.object({
        party_id: partyRef,
        name: z.string().min(1),
        diet: z.enum(["omnivore", "vegetarian", "vegan", "pescatarian"]).optional(),
        allergens: z.array(z.string()).optional(),
        rsvp: z.enum(["yes", "maybe", "no", "unknown"]).optional(),
        notes: z.string().optional(),
      }),
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ party_id, ...input }) => {
      const id = parsePartyId(party_id);
      const updated = await service.update(id, (workspace) => {
        const existing = workspace.guests.find(
          (guest) => guest.name.toLowerCase() === input.name.toLowerCase(),
        );
        const guest = guestFromInput(input, existing);
        workspace.guests = existing
          ? workspace.guests.map((item) => (item.id === existing.id ? guest : item))
          : [...workspace.guests, guest];
        workspace.brief.guestCount = Math.max(
          workspace.brief.guestCount,
          workspace.guests.length,
        );
        workspace.panel = "guests";
        appendLog(workspace, "upsert_guest", `Updated ${guest.name} through MCP.`);
        return guest;
      });
      if (!updated) return missingParty(id);
      return result({
        ok: true,
        party_id: id,
        url: partyUrl(origin, id),
        guest: updated.result,
        updated_at: updated.record.updatedAt,
      });
    },
  );

  server.registerTool(
    "set_seating_preferences",
    {
      title: "Set seating preferences",
      description:
        "Set who one guest should avoid or prefer sitting beside. Names must already exist in the party.",
      inputSchema: z.object({
        party_id: partyRef,
        guest_name: z.string().min(1),
        avoid: z.array(z.string()).optional().default([]),
        prefer: z.array(z.string()).optional().default([]),
      }),
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ party_id, guest_name, avoid, prefer }) => {
      const id = parsePartyId(party_id);
      const updated = await service.update(id, (workspace) => {
        const guest = workspace.guests.find(
          (item) => item.name.toLowerCase() === guest_name.toLowerCase(),
        );
        if (!guest) return { error: `No guest named ${guest_name}.` };
        const byName = new Map(
          workspace.guests.map((item) => [item.name.toLowerCase(), item.id]),
        );
        const missing = [...avoid, ...prefer].filter(
          (name) => !byName.has(name.toLowerCase()),
        );
        guest.avoidSeatWith = avoid
          .map((name) => byName.get(name.toLowerCase()))
          .filter((value): value is string => Boolean(value));
        guest.preferSeatWith = prefer
          .map((name) => byName.get(name.toLowerCase()))
          .filter((value): value is string => Boolean(value));
        workspace.panel = "seating";
        appendLog(workspace, "set_seating_preferences", `Updated ${guest.name}'s seating rules.`);
        return { guest, missing_names: missing };
      });
      if (!updated) return missingParty(id);
      const failed = "error" in updated.result;
      return result({
        ok: !failed,
        party_id: id,
        url: partyUrl(origin, id),
        ...updated.result,
        updated_at: updated.record.updatedAt,
      });
    },
  );

  server.registerTool(
    "propose_menu",
    {
      title: "Propose a constraint-aware menu",
      description:
        "Replace the party menu with real catalog dishes that respect cuisine, diets, allergens, servings, and budget. Fails while the menu is locked.",
      inputSchema: z.object({
        party_id: partyRef,
        cuisine: z.string().optional(),
        guest_count: z.number().int().min(1).max(100).optional(),
        budget_usd: z.number().min(0).nullable().optional(),
        extra_allergens: z.array(z.string()).optional().default([]),
      }),
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ party_id, cuisine, guest_count, budget_usd, extra_allergens }) => {
      const id = parsePartyId(party_id);
      const updated = await service.update(id, (workspace) => {
        if (workspace.menuLocked) return { error: "The menu is locked." };
        const nextCuisine = cuisine ?? (workspace.brief.cuisine || "italian");
        const nextGuestCount =
          guest_count ?? (workspace.brief.guestCount || workspace.guests.length || 6);
        const nextBudget = budget_usd !== undefined ? budget_usd : workspace.brief.budgetUsd;
        const proposed = proposeMenu({
          cuisine: nextCuisine,
          guestCount: nextGuestCount,
          budgetUsd: nextBudget,
          guests: workspace.guests,
          extraAllergens: extra_allergens.map(normalizeAllergen),
        });
        workspace.dishes = proposed.dishes;
        workspace.brief = {
          ...workspace.brief,
          cuisine: nextCuisine,
          guestCount: nextGuestCount,
          budgetUsd: nextBudget,
        };
        workspace.panel = "menu";
        appendLog(workspace, "propose_menu", `Proposed a ${nextCuisine} menu through MCP.`);
        return {
          rationale: proposed.rationale,
          warnings: proposed.warnings,
          dishes: proposed.dishes.map((dish) => dish.name),
          analysis: analyzeMenu(proposed.dishes, workspace.guests, nextBudget),
        };
      });
      if (!updated) return missingParty(id);
      const failed = "error" in updated.result;
      return result({
        ok: !failed,
        party_id: id,
        url: partyUrl(origin, id),
        ...updated.result,
        updated_at: updated.record.updatedAt,
      });
    },
  );

  server.registerTool(
    "substitute_dish",
    {
      title: "Substitute a menu dish",
      description:
        "Replace one current dish with a real catalog alternative matching a constraint such as vegan, gluten-free, or cheaper.",
      inputSchema: z.object({
        party_id: partyRef,
        dish_name: z.string().min(1),
        constraint: z.string().min(1),
      }),
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ party_id, dish_name, constraint }) => {
      const id = parsePartyId(party_id);
      const updated = await service.update(id, (workspace) => {
        if (workspace.menuLocked) return { error: "The menu is locked." };
        const swapped = substituteDish(
          workspace.dishes,
          dish_name,
          constraint,
          workspace.brief.guestCount || workspace.guests.length || 6,
          workspace.guests,
        );
        if (swapped.error) return { error: swapped.error };
        workspace.dishes = swapped.dishes;
        workspace.panel = "menu";
        appendLog(workspace, "substitute_dish", `Substituted ${dish_name} through MCP.`);
        return {
          replaced: swapped.replaced?.name,
          added: swapped.added?.name,
        };
      });
      if (!updated) return missingParty(id);
      const failed = "error" in updated.result;
      return result({
        ok: !failed,
        party_id: id,
        url: partyUrl(origin, id),
        ...updated.result,
        updated_at: updated.record.updatedAt,
      });
    },
  );

  server.registerTool(
    "generate_shopping_list",
    {
      title: "Generate the shopping list",
      description: "Rebuild the shopping list from the current menu and return its cost.",
      inputSchema: z.object({ party_id: partyRef }),
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ party_id }) => {
      const id = parsePartyId(party_id);
      const updated = await service.update(id, (workspace) => {
        workspace.market = buildShoppingList(workspace.dishes);
        workspace.panel = "market";
        appendLog(workspace, "generate_shopping_list", "Generated the market list through MCP.");
        return {
          items: workspace.market,
          estimated_cost: Number(
            workspace.market.reduce((sum, item) => sum + item.estimatedCost, 0).toFixed(2),
          ),
        };
      });
      if (!updated) return missingParty(id);
      return result({
        ok: true,
        party_id: id,
        url: partyUrl(origin, id),
        ...updated.result,
        updated_at: updated.record.updatedAt,
      });
    },
  );

  server.registerTool(
    "auto_seat",
    {
      title: "Build the seating chart",
      description:
        "Seat RSVP'd guests using all avoid and prefer rules. Optionally choose a round or rectangle table.",
      inputSchema: z.object({
        party_id: partyRef,
        shape: z.enum(["round", "rectangle"]).optional(),
      }),
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ party_id, shape }) => {
      const id = parsePartyId(party_id);
      const updated = await service.update(id, (workspace) => {
        const tableShape: TableShape = shape ?? workspace.table.shape;
        workspace.table = {
          shape: tableShape,
          seats: autoSeat(workspace.guests, tableShape),
        };
        workspace.panel = "seating";
        appendLog(workspace, "auto_seat", "Built the seating chart through MCP.");
        return {
          table: workspace.table,
          issues: seatingIssues(workspace.table.seats, workspace.guests),
        };
      });
      if (!updated) return missingParty(id);
      return result({
        ok: true,
        party_id: id,
        url: partyUrl(origin, id),
        ...updated.result,
        updated_at: updated.record.updatedAt,
      });
    },
  );

  server.registerTool(
    "generate_run_of_show",
    {
      title: "Generate the run of show",
      description:
        "Build a day-of preparation timeline working backward from dinner time.",
      inputSchema: z.object({
        party_id: partyRef,
        hours: z.number().min(1).max(24).optional().default(4),
      }),
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ party_id, hours }) => {
      const id = parsePartyId(party_id);
      const updated = await service.update(id, (workspace) => {
        workspace.timeline = buildRunOfShow(
          workspace.dishes,
          workspace.brief.startTime,
          hours,
        );
        workspace.panel = "run";
        appendLog(workspace, "generate_run_of_show", "Generated the timeline through MCP.");
        return { hours, timeline: workspace.timeline };
      });
      if (!updated) return missingParty(id);
      return result({
        ok: true,
        party_id: id,
        url: partyUrl(origin, id),
        ...updated.result,
        updated_at: updated.record.updatedAt,
      });
    },
  );

  server.registerTool(
    "set_menu_lock",
    {
      title: "Set the menu lock",
      description:
        "Lock or unlock the shared menu. ChatGPT should confirm before changing this state.",
      inputSchema: z.object({ party_id: partyRef, locked: z.boolean() }),
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ party_id, locked }) => {
      const id = parsePartyId(party_id);
      const updated = await service.update(id, (workspace) => {
        workspace.menuLocked = locked;
        appendLog(workspace, "set_menu_lock", locked ? "Locked the menu through MCP." : "Unlocked the menu through MCP.");
        return { locked };
      });
      if (!updated) return missingParty(id);
      return result({
        ok: true,
        party_id: id,
        url: partyUrl(origin, id),
        locked,
        updated_at: updated.record.updatedAt,
      });
    },
  );

  server.registerTool(
    "draft_invites",
    {
      title: "Draft party invitations",
      description:
        "Draft invitation copy from the shared brief, guests, and menu. This does not send anything.",
      inputSchema: z.object({ party_id: partyRef }),
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ party_id }) => {
      const id = parsePartyId(party_id);
      const record = await service.get(id);
      if (!record) return missingParty(id);
      const workspace = record.workspace;
      const copy = draftInvites({
        title: workspace.brief.title,
        date: workspace.brief.date,
        startTime: workspace.brief.startTime,
        vibe: workspace.brief.vibe,
        dishes: workspace.dishes,
        guests: workspace.guests,
      });
      return result({
        ok: true,
        party_id: id,
        url: partyUrl(origin, id),
        invitation: copy,
        sent: false,
      });
    },
  );

  server.registerTool(
    "search_catalog",
    {
      title: "Search the Mise dish catalog",
      description:
        "Search real catalog dishes by cuisine, dish name, tag, diet, or ingredient. Never invents dishes.",
      inputSchema: z.object({ query: z.string().min(1) }),
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query }) =>
      result({
        ok: true,
        query,
        dishes: findDishTemplates(query).map((dish) => ({
          id: dish.catalogId,
          name: dish.name,
          cuisine: dish.cuisine,
          course: dish.course,
          diet: dish.diet,
          allergens: dish.allergens,
          cost_per_serving: dish.costPerServing,
        })),
      }),
  );

  return server;
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-expose-headers", "mcp-session-id, mcp-protocol-version");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function handleMcpRequest(
  request: Request,
  service: PartyService,
): Promise<Response> {
  const url = new URL(request.url);
  const allowedHost =
    url.hostname === PRODUCTION_HOST ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "terminal.local";
  if (!allowedHost) return new Response("Forbidden", { status: 403 });

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
        "access-control-allow-headers":
          "accept, content-type, last-event-id, mcp-protocol-version, mcp-session-id",
      },
    });
  }

  const handler = createMcpHandler(
    () => createMiseMcpServer(service, url.origin),
    {
      legacy: "stateless",
    },
  );
  return withCors(await handler.fetch(request));
}
