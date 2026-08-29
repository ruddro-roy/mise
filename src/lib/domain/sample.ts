import { nextWeekday } from "./format";
import { createId } from "./ids";
import { autoSeat, buildRunOfShow, buildShoppingList, instantiateDish } from "./planner";
import { getDishByCatalogId } from "./catalog";
import type { Guest, Workspace } from "./types";

function guest(
  name: string,
  diet: Guest["diet"],
  allergens: string[] = [],
  notes = "",
): Guest {
  return {
    id: createId("guest"),
    name,
    diet,
    allergens,
    avoidSeatWith: [],
    preferSeatWith: [],
    rsvp: "yes",
    notes,
  };
}

export function emptyWorkspace(): Workspace {
  return {
    brief: {
      title: "",
      date: null,
      startTime: "19:00",
      guestCount: 0,
      budgetUsd: null,
      cuisine: "",
      vibe: "",
      notes: "",
    },
    guests: [],
    dishes: [],
    table: { shape: "round", seats: [] },
    market: [],
    timeline: [],
    log: [],
    panel: "brief",
    menuLocked: false,
    invitesSent: false,
    lastTouched: null,
  };
}

export function sampleWorkspace(): Workspace {
  const maya = guest("Maya", "omnivore", ["nuts"], "Keep tree nuts off the table.");
  const tom = guest("Tom", "omnivore", ["gluten"], "Will talk shop if seated with Maya.");
  const priya = guest("Priya", "vegan");
  const eliot = guest("Eliot", "omnivore");
  const sam = guest("Sam", "vegetarian");
  const noor = guest("Noor", "vegan");
  const jules = guest("Jules", "pescatarian");
  const wren = guest("Wren", "omnivore");

  maya.avoidSeatWith = [tom.id];
  tom.avoidSeatWith = [maya.id];
  priya.preferSeatWith = [noor.id];
  noor.preferSeatWith = [priya.id];

  const guests = [maya, tom, priya, eliot, sam, noor, jules, wren];
  const catalogIds = [
    "citrus-fennel-salad",
    "cacio-e-pepe",
    "mushroom-polenta",
    "chili-broccolini",
    "olive-oil-cake",
    "blood-orange-spritz",
  ];
  const dishes = catalogIds
    .map((id) => getDishByCatalogId(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((template) => instantiateDish(template, 8));

  const table = { shape: "round" as const, seats: autoSeat(guests, "round") };

  return {
    brief: {
      title: "Saturday at Maya's",
      date: nextWeekday("saturday"),
      startTime: "19:00",
      guestCount: 8,
      budgetUsd: 90,
      cuisine: "italian",
      vibe: "Warm, unfussy, one long conversation",
      notes: "Family style. Nobody stands to plate.",
    },
    guests,
    dishes,
    table,
    market: buildShoppingList(dishes),
    timeline: buildRunOfShow(dishes, "19:00", 4),
    log: [],
    panel: "brief",
    menuLocked: false,
    invitesSent: false,
    lastTouched: null,
  };
}
