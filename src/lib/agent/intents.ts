import { nextWeekday, titleCase } from "@/lib/domain/format";
import { normalizeAllergen } from "@/lib/domain/diet";
import { CUISINES } from "@/lib/domain/catalog";
import type { Diet, Panel } from "@/lib/domain/types";

export type AgentCall = {
  name: string;
  args: Record<string, unknown>;
};

export type PlanSlots = {
  title?: string;
  date?: string;
  startTime?: string;
  guestCount?: number;
  budgetUsd?: number;
  cuisine?: string;
  vibe?: string;
  veganCount?: number;
  namedGuests: { name: string; diet?: Diet; allergens: string[] }[];
};

const DAY = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const TIME = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
const COUNT = /\b(\d{1,2})\s*(?:people|guests|friends|of us)?\b/i;
const BUDGET = /\$\s*(\d{2,4})\b|\b(\d{2,4})\s*(?:dollars|usd|budget)\b/i;
const VEGAN = /\b(one|two|three|four|\d+)\s+vegan/;
const WORD: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };

function to24h(hour: number, minute: number, mer: string): string {
  let h = hour % 12;
  if (mer.toLowerCase() === "pm") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseNumberWord(value: string): number {
  return WORD[value.toLowerCase()] ?? Number(value);
}

export function extractPlanSlots(prompt: string): PlanSlots {
  const namedGuests: PlanSlots["namedGuests"] = [];
  const allergy = /([A-Z][a-z]+)\s+has\s+(?:a\s+)?([a-z]+(?:\s+nut)?)\s+allerg/g;
  let match: RegExpExecArray | null;
  while ((match = allergy.exec(prompt))) {
    namedGuests.push({
      name: match[1],
      allergens: [normalizeAllergen(match[2])],
    });
  }

  const day = prompt.match(DAY)?.[1];
  const time = prompt.match(TIME);
  const count = prompt.match(COUNT);
  const budget = prompt.match(BUDGET);
  const vegan = prompt.match(VEGAN);
  const cuisine = CUISINES.find((item) => prompt.toLowerCase().includes(item));

  const vibeBits = prompt.match(
    /\b(warm|unfussy|quiet|loud|fancy|casual|long conversation|weeknight)\b/gi,
  );

  return {
    date: day ? nextWeekday(day) : undefined,
    startTime: time
      ? to24h(Number(time[1]), Number(time[2] ?? 0), time[3])
      : undefined,
    guestCount: count ? Number(count[1]) : undefined,
    budgetUsd: budget ? Number(budget[1] ?? budget[2]) : undefined,
    cuisine,
    veganCount: vegan ? parseNumberWord(vegan[1]) : undefined,
    vibe: vibeBits?.length ? titleCase(vibeBits.join(", ").toLowerCase()) : undefined,
    namedGuests,
  };
}

function mentions(prompt: string, ...needles: string[]): boolean {
  const lower = prompt.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

export function planCalls(prompt: string): AgentCall[] {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const calls: AgentCall[] = [];
  const slots = extractPlanSlots(text);

  if (mentions(lower, "sample saturday", "load the sample", "demo party")) {
    calls.push({ name: "load_sample_party", args: {} });
    return calls;
  }
  if (mentions(lower, "clear the table", "reset", "start over") && text.length < 40) {
    calls.push({ name: "reset_workspace", args: {} });
    return calls;
  }

  const planning = mentions(
    lower,
    "plan",
    "dinner",
    "host",
    "saturday",
    "italian",
    "mexican",
    "menu for",
  );
  if (planning && (slots.guestCount || slots.cuisine || slots.budgetUsd || slots.namedGuests.length)) {
    calls.push({ name: "focus_panel", args: { panel: "brief" } });
    calls.push({
      name: "set_event_brief",
      args: {
        title: slots.date ? "Saturday dinner" : "Dinner",
        ...(slots.date ? { date: slots.date } : {}),
        ...(slots.startTime ? { startTime: slots.startTime } : { startTime: "19:00" }),
        ...(slots.guestCount ? { guestCount: slots.guestCount } : {}),
        ...(slots.budgetUsd ? { budgetUsd: slots.budgetUsd } : {}),
        ...(slots.cuisine ? { cuisine: slots.cuisine } : {}),
        ...(slots.vibe ? { vibe: slots.vibe } : {}),
      },
    });

    const placeholders = Math.max(slots.guestCount ?? 0, slots.namedGuests.length);
    const names = ["Maya", "Tom", "Priya", "Eliot", "Sam", "Noor", "Jules", "Wren", "Ada", "Leo"];
    const used = new Set(slots.namedGuests.map((guest) => guest.name.toLowerCase()));
    const guests = [...slots.namedGuests];
    for (let i = guests.length; i < placeholders; i += 1) {
      const name = names.find((item) => !used.has(item.toLowerCase())) ?? `Guest ${i + 1}`;
      used.add(name.toLowerCase());
      guests.push({ name, allergens: [] });
    }
    let veganLeft = slots.veganCount ?? 0;
    for (const guest of guests) {
      let diet: Diet = guest.diet ?? "omnivore";
      if (!guest.diet && veganLeft > 0) {
        diet = "vegan";
        veganLeft -= 1;
      }
      calls.push({
        name: "add_guest",
        args: {
          name: guest.name,
          diet,
          allergens: guest.allergens,
        },
      });
    }

    calls.push({
      name: "propose_menu",
      args: {
        ...(slots.cuisine ? { cuisine: slots.cuisine } : {}),
        ...(slots.guestCount ? { guestCount: slots.guestCount } : {}),
        ...(slots.budgetUsd ? { budgetUsd: slots.budgetUsd } : {}),
      },
    });
    calls.push({ name: "generate_shopping_list", args: {} });
    calls.push({ name: "auto_seat", args: {} });
  }

  if (mentions(lower, "seat", "sit ", "away from", "together")) {
    const away = /seat\s+([A-Z][a-z]+)\s+away from\s+([A-Z][a-z]+)/i.exec(text);
    if (away) {
      calls.push({
        name: "update_guest",
        args: { name: away[1], avoidSeatWith: away[2] },
      });
      calls.push({
        name: "update_guest",
        args: { name: away[2], avoidSeatWith: away[1] },
      });
    }
    if (mentions(lower, "vegans together", "vegan together")) {
      calls.push({ name: "link_guests_by_diet", args: { diet: "vegan" } });
    }
    calls.push({ name: "auto_seat", args: {} });
  }

  if (mentions(lower, "swap", "gluten", "replace", "instead of")) {
    const pasta = mentions(lower, "pasta", "cacio", "spaghetti", "tonnarelli");
    const constraint = mentions(lower, "gluten")
      ? "gluten-free"
      : mentions(lower, "vegan")
        ? "vegan"
        : mentions(lower, "vegetarian")
          ? "vegetarian"
          : "gluten-free";
    calls.push({
      name: "substitute_dish",
      args: { name: pasta ? "cacio" : "main", constraint },
    });
    if (mentions(lower, "market", "shop", "rebuild")) {
      calls.push({ name: "generate_shopping_list", args: {} });
    }
  } else if (mentions(lower, "shopping", "market list", "rebuild the market")) {
    calls.push({ name: "generate_shopping_list", args: {} });
  }

  if (mentions(lower, "run of show", "timeline", "day-of", "day of")) {
    const hours = /\b(\d(?:\.\d)?)\s*-?\s*hour/.exec(lower);
    calls.push({
      name: "generate_run_of_show",
      args: { hours: hours ? Number(hours[1]) : 4 },
    });
  }

  if (mentions(lower, "unlock")) {
    calls.push({ name: "unlock_menu", args: {} });
  } else if (
    mentions(
      lower,
      "lock",
      "book it",
      "book this",
      "book the table",
      "confirm the menu",
      "confirm it",
    )
  ) {
    calls.push({ name: "lock_menu", args: {} });
  }
  if (mentions(lower, "invite", "send them")) {
    calls.push({ name: "send_invites", args: {} });
  }

  if (mentions(lower, "what's the plan", "what is the plan", "status", "where are we")) {
    calls.unshift({ name: "get_workspace_state", args: {} });
  }

  const panelMatch = /\b(brief|guests|menu|seating|market|run)\b/.exec(lower);
  if (mentions(lower, "show me", "open the", "look at") && panelMatch) {
    calls.push({ name: "focus_panel", args: { panel: panelMatch[1] as Panel } });
  }

  const seen = new Set<string>();
  return calls.filter((call) => {
    const key = `${call.name}:${JSON.stringify(call.args)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
