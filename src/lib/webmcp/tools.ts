import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { CATALOG, type CatalogItem } from "@/lib/domain/catalog"
import {
  autoSeat,
  buildShoppingList,
  proposeMenu,
  scoreMenuFit,
} from "@/lib/domain/planner"
import type { PartyStore } from "@/lib/store/party-store"
import type {
  AgentRun,
  ConstraintKind,
  CourseKind,
  Guest,
  GuestRole,
  MenuItem,
  Party,
} from "@/lib/store/types"

const COURSE_KINDS = ["amuse", "starter", "main", "side", "dessert", "drink"] as const
const CONSTRAINT_KINDS = ["diet", "allergy", "dislike", "preference", "access"] as const
const GUEST_ROLES = ["host", "guest", "plus-one", "child"] as const

function itemById(id: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.id === id)
}

function requireParty(store: PartyStore, partyId: string): Party {
  const party = store.getParty(partyId)
  if (!party) {
    throw new Error(`Party ${partyId} not found`)
  }
  return party
}

function requireGuest(store: PartyStore, partyId: string, guestId: string): Guest {
  const party = requireParty(store, partyId)
  const guest = party.guests.find((item) => item.id === guestId)
  if (!guest) {
    throw new Error(`Guest ${guestId} not found`)
  }
  return guest
}

function requireRun(store: PartyStore, partyId: string, runId: string): AgentRun {
  const party = requireParty(store, partyId)
  const run = party.runs.find((item) => item.id === runId)
  if (!run) {
    throw new Error(`Run ${runId} not found`)
  }
  return run
}

function compactCatalog() {
  return CATALOG.map((item) => ({
    id: item.id,
    name: item.name,
    kind: item.kind,
    course: item.course,
    dietFlags: item.dietFlags,
    allergens: item.allergens,
    effort: item.effort,
    cost: item.cost,
    winePairing: item.winePairing,
  }))
}

export function registerPartyTools(server: McpServer, store: PartyStore) {
  server.registerTool(
    "list_parties",
    {
      description: "List dinner parties with guest counts and next action.",
      inputSchema: z.object({}),
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify({ parties: store.listParties() }) }],
    }),
  )

  server.registerTool(
    "get_party",
    {
      description: "Load one party: guests, menu, seating, market, and agent runs.",
      inputSchema: z.object({
        partyId: z.string(),
      }),
    },
    async ({ partyId }) => {
      const party = requireParty(store, partyId)
      return { content: [{ type: "text", text: JSON.stringify({ party }) }] }
    },
  )

  server.registerTool(
    "create_party",
    {
      description: "Create a dinner party brief. Returns the new partyId.",
      inputSchema: z.object({
        title: z.string().min(1),
        date: z.string().min(1),
        time: z.string().min(1),
        guestCount: z.number().int().min(1).max(24),
        budget: z.enum(["tight", "comfortable", "splash"]),
        vibe: z.enum(["weeknight", "celebration", "formal", "potluck"]),
        cuisine: z.string().min(1),
        notes: z.string().optional(),
      }),
    },
    async (input) => {
      const party = store.createParty(input)
      return { content: [{ type: "text", text: JSON.stringify({ party }) }] }
    },
  )

  server.registerTool(
    "update_party",
    {
      description: "Patch the dinner brief fields.",
      inputSchema: z.object({
        partyId: z.string(),
        title: z.string().min(1).optional(),
        date: z.string().min(1).optional(),
        time: z.string().min(1).optional(),
        guestCount: z.number().int().min(1).max(24).optional(),
        budget: z.enum(["tight", "comfortable", "splash"]).optional(),
        vibe: z.enum(["weeknight", "celebration", "formal", "potluck"]).optional(),
        cuisine: z.string().min(1).optional(),
        notes: z.string().optional(),
      }),
    },
    async ({ partyId, ...patch }) => {
      requireParty(store, partyId)
      const party = store.updateParty(partyId, patch)
      return { content: [{ type: "text", text: JSON.stringify({ party }) }] }
    },
  )

  server.registerTool(
    "list_catalog",
    {
      description: "Browse the dish and drink catalog used by the planner.",
      inputSchema: z.object({
        course: z.enum(COURSE_KINDS).optional(),
        query: z.string().optional(),
      }),
    },
    async ({ course, query }) => {
      const q = query?.toLowerCase()
      const items = compactCatalog().filter((item) => {
        if (course && item.course !== course) return false
        if (!q) return true
        return `${item.name} ${item.id}`.toLowerCase().includes(q)
      })
      return { content: [{ type: "text", text: JSON.stringify({ items }) }] }
    },
  )
}

export function registerGuestTools(server: McpServer, store: PartyStore) {
  server.registerTool(
    "add_guest",
    {
      description: "Add a guest with optional dietary constraints.",
      inputSchema: z.object({
        partyId: z.string(),
        name: z.string().min(1),
        role: z.enum(GUEST_ROLES).optional(),
        household: z.string().optional(),
        notes: z.string().optional(),
        constraints: z
          .array(
            z.object({
              kind: z.enum(CONSTRAINT_KINDS),
              label: z.string().min(1),
              severity: z.enum(["hard", "soft"]),
            }),
          )
          .optional(),
      }),
    },
    async ({ partyId, ...input }) => {
      requireParty(store, partyId)
      const guest = store.addGuest(partyId, {
        name: input.name,
        role: input.role ?? "guest",
        household: input.household,
        notes: input.notes,
        constraints: (input.constraints ?? []).map((constraint) => ({
          id: crypto.randomUUID(),
          kind: constraint.kind as ConstraintKind,
          label: constraint.label,
          severity: constraint.severity,
        })),
      })
      return { content: [{ type: "text", text: JSON.stringify({ guest }) }] }
    },
  )

  server.registerTool(
    "update_guest",
    {
      description: "Rename a guest or change role, household, and notes.",
      inputSchema: z.object({
        partyId: z.string(),
        guestId: z.string(),
        name: z.string().min(1).optional(),
        role: z.enum(GUEST_ROLES).optional(),
        household: z.string().optional(),
        notes: z.string().optional(),
      }),
    },
    async ({ partyId, guestId, ...patch }) => {
      requireGuest(store, partyId, guestId)
      const guest = store.updateGuest(partyId, guestId, patch as Partial<Guest>)
      return { content: [{ type: "text", text: JSON.stringify({ guest }) }] }
    },
  )

  server.registerTool(
    "remove_guest",
    {
      description: "Remove a guest and drop them from seating.",
      inputSchema: z.object({
        partyId: z.string(),
        guestId: z.string(),
      }),
    },
    async ({ partyId, guestId }) => {
      requireGuest(store, partyId, guestId)
      store.removeGuest(partyId, guestId)
      return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] }
    },
  )

  server.registerTool(
    "set_guest_constraint",
    {
      description: "Add or replace a dietary or access constraint on a guest.",
      inputSchema: z.object({
        partyId: z.string(),
        guestId: z.string(),
        constraintId: z.string().optional(),
        kind: z.enum(CONSTRAINT_KINDS),
        label: z.string().min(1),
        severity: z.enum(["hard", "soft"]),
      }),
    },
    async ({ partyId, guestId, constraintId, kind, label, severity }) => {
      const guest = requireGuest(store, partyId, guestId)
      const next = constraintId
        ? guest.constraints.map((constraint) =>
            constraint.id === constraintId
              ? { ...constraint, kind: kind as ConstraintKind, label, severity }
              : constraint,
          )
        : [
            ...guest.constraints,
            { id: crypto.randomUUID(), kind: kind as ConstraintKind, label, severity },
          ]
      const updated = store.updateGuest(partyId, guestId, { constraints: next })
      return { content: [{ type: "text", text: JSON.stringify({ guest: updated }) }] }
    },
  )
}

export function registerMenuTools(server: McpServer, store: PartyStore) {
  server.registerTool(
    "propose_menu",
    {
      description: "Draft a full menu from the catalog using party constraints.",
      inputSchema: z.object({
        partyId: z.string(),
        replaceExisting: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ partyId, replaceExisting }) => {
      const party = requireParty(store, partyId)
      const items = proposeMenu(party)
      if (replaceExisting || party.menu.length === 0) {
        store.replaceMenu(partyId, items)
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              items,
              applied: replaceExisting || party.menu.length === 0,
              score: scoreMenuFit({ ...party, menu: items }),
            }),
          },
        ],
      }
    },
  )

  server.registerTool(
    "add_menu_item",
    {
      description: "Pin a catalog dish to the menu.",
      inputSchema: z.object({
        partyId: z.string(),
        catalogId: z.string(),
        course: z.enum(COURSE_KINDS).optional(),
        servings: z.number().int().min(1).max(24).optional(),
        notes: z.string().optional(),
      }),
    },
    async ({ partyId, catalogId, course, servings, notes }) => {
      const party = requireParty(store, partyId)
      const catalog = itemById(catalogId)
      if (!catalog) {
        throw new Error(`Catalog item ${catalogId} not found`)
      }
      const item = store.addMenuItem(partyId, {
        catalogId,
        name: catalog.name,
        course: (course ?? catalog.course) as CourseKind,
        servings: servings ?? party.guestCount,
        notes,
        locked: false,
      })
      return { content: [{ type: "text", text: JSON.stringify({ item }) }] }
    },
  )

  server.registerTool(
    "update_menu_item",
    {
      description: "Change servings, course, notes, or lock state for a menu item.",
      inputSchema: z.object({
        partyId: z.string(),
        itemId: z.string(),
        course: z.enum(COURSE_KINDS).optional(),
        servings: z.number().int().min(1).max(24).optional(),
        notes: z.string().optional(),
        locked: z.boolean().optional(),
      }),
    },
    async ({ partyId, itemId, ...patch }) => {
      const party = requireParty(store, partyId)
      if (!party.menu.some((item) => item.id === itemId)) {
        throw new Error(`Menu item ${itemId} not found`)
      }
      const item = store.updateMenuItem(partyId, itemId, patch as Partial<MenuItem>)
      return { content: [{ type: "text", text: JSON.stringify({ item }) }] }
    },
  )

  server.registerTool(
    "remove_menu_item",
    {
      description: "Drop a dish from the menu.",
      inputSchema: z.object({
        partyId: z.string(),
        itemId: z.string(),
      }),
    },
    async ({ partyId, itemId }) => {
      requireParty(store, partyId)
      store.removeMenuItem(partyId, itemId)
      return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] }
    },
  )

  server.registerTool(
    "score_menu",
    {
      description: "Score the current menu against guest constraints and budget.",
      inputSchema: z.object({
        partyId: z.string(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ partyId }) => {
      const party = requireParty(store, partyId)
      return {
        content: [{ type: "text", text: JSON.stringify({ score: scoreMenuFit(party) }) }],
      }
    },
  )
}

export function registerSeatingTools(server: McpServer, store: PartyStore) {
  server.registerTool(
    "auto_seat",
    {
      description: "Generate a seating plan that splits households and balances talkers.",
      inputSchema: z.object({
        partyId: z.string(),
        apply: z.boolean().optional(),
      }),
    },
    async ({ partyId, apply }) => {
      const party = requireParty(store, partyId)
      const seats = autoSeat(party)
      if (apply !== false) {
        store.replaceSeats(partyId, seats)
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ seats, applied: apply !== false }),
          },
        ],
      }
    },
  )

  server.registerTool(
    "assign_seat",
    {
      description: "Place one guest at a seat. Clears their previous seat.",
      inputSchema: z.object({
        partyId: z.string(),
        guestId: z.string(),
        seatIndex: z.number().int().min(0),
        locked: z.boolean().optional(),
      }),
    },
    async ({ partyId, guestId, seatIndex, locked }) => {
      requireGuest(store, partyId, guestId)
      const seat = store.assignSeat(partyId, { guestId, seatIndex, locked })
      return { content: [{ type: "text", text: JSON.stringify({ seat }) }] }
    },
  )
}

export function registerMarketTools(server: McpServer, store: PartyStore) {
  server.registerTool(
    "build_shopping_list",
    {
      description: "Roll the menu into a shopping list grouped by aisle.",
      inputSchema: z.object({
        partyId: z.string(),
        apply: z.boolean().optional(),
      }),
    },
    async ({ partyId, apply }) => {
      const party = requireParty(store, partyId)
      const items = buildShoppingList(party)
      if (apply !== false) {
        store.replaceMarket(partyId, items)
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ items, applied: apply !== false }),
          },
        ],
      }
    },
  )

  server.registerTool(
    "toggle_market_item",
    {
      description: "Mark a shopping-list line bought or not bought.",
      inputSchema: z.object({
        partyId: z.string(),
        itemId: z.string(),
        bought: z.boolean(),
      }),
    },
    async ({ partyId, itemId, bought }) => {
      requireParty(store, partyId)
      const item = store.toggleMarketItem(partyId, itemId, bought)
      return { content: [{ type: "text", text: JSON.stringify({ item }) }] }
    },
  )
}

export function registerRunTools(server: McpServer, store: PartyStore) {
  server.registerTool(
    "start_run",
    {
      description: "Open an agent run and attach the first thinking event.",
      inputSchema: z.object({
        partyId: z.string(),
        title: z.string().min(1),
      }),
    },
    async ({ partyId, title }) => {
      requireParty(store, partyId)
      const run = store.startRun(partyId, title)
      return { content: [{ type: "text", text: JSON.stringify({ run }) }] }
    },
  )

  server.registerTool(
    "append_run_event",
    {
      description: "Append a thinking, tool, or result event to an agent run.",
      inputSchema: z.object({
        partyId: z.string(),
        runId: z.string(),
        kind: z.enum(["thinking", "tool", "result", "error"]),
        label: z.string().min(1),
        detail: z.string().optional(),
      }),
    },
    async ({ partyId, runId, kind, label, detail }) => {
      requireRun(store, partyId, runId)
      const event = store.appendRunEvent(partyId, runId, { kind, label, detail })
      return { content: [{ type: "text", text: JSON.stringify({ event }) }] }
    },
  )

  server.registerTool(
    "complete_run",
    {
      description: "Mark an agent run finished or failed.",
      inputSchema: z.object({
        partyId: z.string(),
        runId: z.string(),
        status: z.enum(["complete", "error"]),
      }),
    },
    async ({ partyId, runId, status }) => {
      requireRun(store, partyId, runId)
      const run = store.completeRun(partyId, runId, status)
      return { content: [{ type: "text", text: JSON.stringify({ run }) }] }
    },
  )
}
