import { DISH_CATALOG } from "./catalog";
import { dishFeedsDiet } from "./diet";
import { createId } from "./ids";
import type {
  Course,
  Diet,
  Dish,
  DishTemplate,
  Guest,
  MarketItem,
  MenuAnalysis,
  MenuWarning,
  Seat,
  SeatingIssue,
  TableShape,
  TimelineStep,
} from "./types";

const COURSES: Course[] = ["starter", "main", "side", "dessert", "drink"];

export function instantiateDish(template: DishTemplate, servings: number): Dish {
  return {
    ...template,
    id: createId("dish"),
    servings,
    notes: "",
    ingredients: template.ingredients.map((ingredient) => ({ ...ingredient })),
  };
}

export function dishEstimatedCost(dish: Dish): number {
  return Number((dish.costPerServing * dish.servings).toFixed(2));
}

function familyAllergens(guests: Guest[], extra: string[] = []): Set<string> {
  const set = new Set(extra.map((item) => item.toLowerCase()));
  for (const guest of guests) {
    for (const allergen of guest.allergens) set.add(allergen.toLowerCase());
  }
  return set;
}

function isSafe(template: DishTemplate, banned: Set<string>): boolean {
  return !template.allergens.some((allergen) => banned.has(allergen.toLowerCase()));
}

function cuisineScore(template: DishTemplate, cuisine: string): number {
  if (!cuisine || cuisine === "mixed") return 0;
  return template.cuisine === cuisine.toLowerCase() ? 12 : -4;
}

function dietNeed(guests: Guest[]): Record<Diet, number> {
  const counts: Record<Diet, number> = {
    vegan: 0,
    vegetarian: 0,
    pescatarian: 0,
    omnivore: 0,
  };
  for (const guest of guests) counts[guest.diet] += 1;
  return counts;
}

function pickBest(
  pool: DishTemplate[],
  cuisine: string,
  preferDiet?: Diet,
): DishTemplate | undefined {
  const ranked = [...pool].sort((a, b) => {
    const dietBoost = (dish: DishTemplate) =>
      preferDiet && dish.diet === preferDiet ? 8 : 0;
    return cuisineScore(b, cuisine) + dietBoost(b) - (cuisineScore(a, cuisine) + dietBoost(a));
  });
  return ranked[0];
}

export function proposeMenu(input: {
  cuisine: string;
  guestCount: number;
  budgetUsd: number | null;
  guests: Guest[];
  extraAllergens?: string[];
}): { dishes: Dish[]; rationale: string; warnings: string[] } {
  const servings = Math.max(input.guestCount, input.guests.length, 1);
  const banned = familyAllergens(input.guests, input.extraAllergens);
  const safe = DISH_CATALOG.filter((dish) => isSafe(dish, banned));
  const needs = dietNeed(input.guests);
  const veganGuests = needs.vegan;
  const warnings: string[] = [];
  const chosen: DishTemplate[] = [];

  const take = (dish: DishTemplate | undefined) => {
    if (!dish) return;
    if (chosen.some((item) => item.catalogId === dish.catalogId)) return;
    chosen.push(dish);
  };

  const unused = () =>
    safe.filter((dish) => !chosen.some((item) => item.catalogId === dish.catalogId));

  take(pickBest(unused().filter((dish) => dish.course === "starter"), input.cuisine, "vegan"));

  if (veganGuests > 0) {
    take(
      pickBest(
        unused().filter((dish) => dish.course === "main" && dish.diet === "vegan"),
        input.cuisine,
        "vegan",
      ),
    );
  }

  const wantsAnimal =
    needs.omnivore + needs.pescatarian > 0 || input.guests.length === 0;
  if (wantsAnimal) {
    const animalMains = unused().filter(
      (dish) =>
        dish.course === "main" &&
        (dish.diet === "omnivore" || dish.diet === "pescatarian"),
    );
    take(pickBest(animalMains, input.cuisine));
  }

  if (!chosen.some((dish) => dish.course === "main")) {
    take(pickBest(unused().filter((dish) => dish.course === "main"), input.cuisine));
  }

  if (
    needs.vegetarian > 0 &&
    !chosen.some((dish) => dish.course === "main" && dishFeedsDiet(dish.diet, "vegetarian"))
  ) {
    take(
      pickBest(
        unused().filter(
          (dish) => dish.course === "main" && dishFeedsDiet(dish.diet, "vegetarian"),
        ),
        input.cuisine,
      ),
    );
  }

  take(pickBest(unused().filter((dish) => dish.course === "side"), input.cuisine, "vegan"));
  take(pickBest(unused().filter((dish) => dish.course === "dessert"), input.cuisine));
  take(pickBest(unused().filter((dish) => dish.course === "drink"), input.cuisine, "vegan"));

  let dishes = chosen.map((template) => instantiateDish(template, servings));

  if (input.budgetUsd != null) {
    let cost = dishes.reduce((sum, dish) => sum + dishEstimatedCost(dish), 0);
    if (cost > input.budgetUsd) {
      const drink = dishes.find((dish) => dish.course === "drink");
      if (drink && cost - dishEstimatedCost(drink) <= input.budgetUsd) {
        dishes = dishes.filter((dish) => dish.id !== drink.id);
        warnings.push("Dropped the house drink to stay inside the budget.");
        cost = dishes.reduce((sum, dish) => sum + dishEstimatedCost(dish), 0);
      }
    }
    if (cost > input.budgetUsd) {
      warnings.push(
        `The menu still runs about $${cost.toFixed(0)} against a $${input.budgetUsd} budget.`,
      );
    }
  }

  if (veganGuests > 0 && !dishes.some((dish) => dish.course === "main" && dish.diet === "vegan")) {
    warnings.push("Could not find a vegan main that is safe for every allergen at the table.");
  }

  const cuisine = input.cuisine || "mixed";
  const rationale = [
    `A ${cuisine} table for ${servings}.`,
    banned.size
      ? `Kept ${[...banned].join(", ")} off the family-style menu.`
      : "No household allergens were listed.",
    veganGuests
      ? `${veganGuests} vegan guest${veganGuests === 1 ? "" : "s"} get a dedicated main.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return { dishes, rationale, warnings };
}

export function substituteDish(
  current: Dish[],
  targetName: string,
  constraint: string,
  guestCount: number,
  guests: Guest[],
): { dishes: Dish[]; replaced?: Dish; added?: Dish; error?: string } {
  const needle = targetName.toLowerCase();
  const target = current.find(
    (dish) =>
      dish.name.toLowerCase().includes(needle) ||
      dish.catalogId.includes(needle) ||
      dish.tags.some((tag) => tag.includes(needle)),
  );
  if (!target) {
    return { dishes: current, error: `No dish matching "${targetName}" is on the menu.` };
  }

  const banned = familyAllergens(guests);
  const constraintNorm = constraint.toLowerCase();
  const pool = DISH_CATALOG.filter((dish) => {
    if (dish.catalogId === target.catalogId) return false;
    if (dish.course !== target.course) return false;
    if (!isSafe(dish, banned)) return false;
    if (constraintNorm.includes("vegan") && dish.diet !== "vegan") return false;
    if (
      (constraintNorm.includes("gluten-free") || constraintNorm.includes("gluten free")) &&
      (dish.allergens.includes("gluten") || !dish.tags.includes("gluten-free"))
    ) {
      return false;
    }
    if (constraintNorm.includes("vegetarian") && !dishFeedsDiet(dish.diet, "vegetarian")) {
      return false;
    }
    if (constraintNorm.includes("cheaper") && dish.costPerServing >= target.costPerServing) {
      return false;
    }
    return true;
  });

  const nextTemplate = pickBest(pool, target.cuisine, target.diet);
  if (!nextTemplate) {
    return {
      dishes: current,
      error: `No ${target.course} in the catalog satisfies "${constraint}" without breaking allergens.`,
    };
  }

  const added = instantiateDish(nextTemplate, target.servings || guestCount);
  added.notes = `Stood in for ${target.name}.`;
  return {
    dishes: current.map((dish) => (dish.id === target.id ? added : dish)),
    replaced: target,
    added,
  };
}

export function analyzeMenu(
  dishes: Dish[],
  guests: Guest[],
  budgetUsd: number | null,
): MenuAnalysis {
  const estimatedCost = Number(
    dishes.reduce((sum, dish) => sum + dishEstimatedCost(dish), 0).toFixed(2),
  );
  const remainingBudget =
    budgetUsd == null ? null : Number((budgetUsd - estimatedCost).toFixed(2));

  const diets: Diet[] = ["vegan", "vegetarian", "pescatarian", "omnivore"];
  const dietCoverage = Object.fromEntries(
    diets.map((diet) => [
      diet,
      {
        guests: guests.filter((guest) => guest.diet === diet).length,
        mains: dishes.filter(
          (dish) => dish.course === "main" && dishFeedsDiet(dish.diet, diet),
        ).length,
        any: dishes.filter((dish) => dishFeedsDiet(dish.diet, diet)).length,
      },
    ]),
  ) as MenuAnalysis["dietCoverage"];

  const allergenConflicts: MenuAnalysis["allergenConflicts"] = [];
  for (const guest of guests) {
    for (const dish of dishes) {
      for (const allergen of dish.allergens) {
        if (guest.allergens.map((item) => item.toLowerCase()).includes(allergen.toLowerCase())) {
          allergenConflicts.push({
            guest: guest.name,
            dish: dish.name,
            allergen,
          });
        }
      }
    }
  }

  const present = new Set(dishes.map((dish) => dish.course));
  const missingCourses = COURSES.filter((course) => !present.has(course));

  const warnings: MenuWarning[] = [];
  if (dietCoverage.vegan.guests > 0 && dietCoverage.vegan.mains === 0) {
    warnings.push({
      code: "missing_vegan_main",
      message: "Vegan guests do not have a main they can eat.",
    });
  }
  if (remainingBudget != null && remainingBudget < 0) {
    warnings.push({
      code: "over_budget",
      message: `The market run is ${Math.abs(remainingBudget).toFixed(0)} over budget.`,
    });
  }
  if (allergenConflicts.length) {
    warnings.push({
      code: "allergen",
      message: "A listed allergen still appears on the family-style menu.",
    });
  }

  return {
    estimatedCost,
    remainingBudget,
    dietCoverage,
    allergenConflicts,
    missingCourses,
    warnings,
  };
}

export function autoSeat(guests: Guest[], shape: TableShape): Seat[] {
  const attending = guests.filter((guest) => guest.rsvp !== "no");
  const count = Math.max(attending.length, 2);
  const order: Guest[] = [];
  const remaining = [...attending];

  const take = (guest: Guest | undefined) => {
    if (!guest) return;
    order.push(guest);
    const index = remaining.findIndex((item) => item.id === guest.id);
    if (index >= 0) remaining.splice(index, 1);
  };

  take(remaining[0]);
  while (remaining.length) {
    const last = order[order.length - 1];
    const preferred = remaining.find((guest) => last?.preferSeatWith.includes(guest.id));
    if (preferred) {
      take(preferred);
      continue;
    }
    const safe = remaining.find(
      (guest) =>
        !last?.avoidSeatWith.includes(guest.id) && !guest.avoidSeatWith.includes(last?.id ?? ""),
    );
    take(safe ?? remaining[0]);
  }

  for (let pass = 0; pass < count * 2; pass += 1) {
    let swapped = false;
    for (let i = 0; i < order.length; i += 1) {
      const next = (i + 1) % order.length;
      const a = order[i];
      const b = order[next];
      if (a.avoidSeatWith.includes(b.id) || b.avoidSeatWith.includes(a.id)) {
        const candidate = order.findIndex(
          (guest, index) =>
            index !== i &&
            index !== next &&
            !a.avoidSeatWith.includes(guest.id) &&
            !guest.avoidSeatWith.includes(a.id),
        );
        if (candidate >= 0) {
          const tmp = order[next];
          order[next] = order[candidate];
          order[candidate] = tmp;
          swapped = true;
        }
      }
    }
    if (!swapped) break;
  }

  const seats: Seat[] = Array.from({ length: count }, (_, index) => ({
    index,
    guestId: order[index]?.id ?? null,
  }));

  void shape;
  return seats;
}

export function seatingIssues(seats: Seat[], guests: Guest[]): SeatingIssue[] {
  const issues: SeatingIssue[] = [];
  const byId = new Map(guests.map((guest) => [guest.id, guest]));
  const count = seats.length;
  if (!count) return issues;

  for (let i = 0; i < count; i += 1) {
    const guest = byId.get(seats[i]?.guestId ?? "");
    if (!guest) continue;
    const neighbors = [
      byId.get(seats[(i + 1) % count]?.guestId ?? ""),
      byId.get(seats[(i - 1 + count) % count]?.guestId ?? ""),
    ].filter((item): item is Guest => Boolean(item));

    for (const neighbor of neighbors) {
      if (guest.avoidSeatWith.includes(neighbor.id)) {
        issues.push({
          code: "avoid",
          message: `${guest.name} asked not to sit beside ${neighbor.name}.`,
          guestIds: [guest.id, neighbor.id],
        });
      }
    }

    for (const preferId of guest.preferSeatWith) {
      const friend = byId.get(preferId);
      if (!friend) continue;
      if (!neighbors.some((neighbor) => neighbor.id === preferId)) {
        issues.push({
          code: "prefer",
          message: `${guest.name} wanted to sit with ${friend.name}.`,
          guestIds: [guest.id, preferId],
        });
      }
    }
  }

  return issues;
}

export function buildShoppingList(dishes: Dish[]): MarketItem[] {
  const buckets = new Map<
    string,
    { name: string; qty: number; unit: string; cost: number; aisle: string; dishes: Set<string> }
  >();

  for (const dish of dishes) {
    const scale = dish.servings;
    for (const ingredient of dish.ingredients) {
      if (ingredient.pantry) continue;
      const key = `${ingredient.name.toLowerCase()}|${ingredient.unit}`;
      const current = buckets.get(key) ?? {
        name: ingredient.name,
        qty: 0,
        unit: ingredient.unit,
        cost: 0,
        aisle: ingredient.aisle,
        dishes: new Set<string>(),
      };
      current.qty += ingredient.qty * scale;
      current.cost += ingredient.unitCost * scale;
      current.dishes.add(dish.name);
      buckets.set(key, current);
    }
  }

  return [...buckets.values()]
    .map((item) => ({
      id: createId("mkt"),
      name: item.name,
      qty: Number(item.qty.toFixed(2)),
      unit: item.unit,
      estimatedCost: Number(item.cost.toFixed(2)),
      aisle: item.aisle,
      checked: false,
      forDishes: [...item.dishes],
    }))
    .sort((a, b) => a.aisle.localeCompare(b.aisle) || a.name.localeCompare(b.name));
}

export function buildRunOfShow(
  dishes: Dish[],
  startTime: string | null,
  hours = 4,
): TimelineStep[] {
  void startTime;
  const window = Math.round(hours * 60);
  const steps: TimelineStep[] = [
    {
      id: createId("step"),
      offsetMinutes: -window,
      title: "Market run",
      detail: "Buy what is not already in the pantry. Check the list before you leave the last aisle.",
      owner: "host",
    },
    {
      id: createId("step"),
      offsetMinutes: -Math.round(window * 0.7),
      title: "Mise en place",
      detail: "Wash, chop, and set out every mise bowl. Put a sticky note on anything that cannot sit.",
      owner: "host",
    },
  ];

  const mains = dishes.filter((dish) => dish.course === "main");
  const others = dishes.filter((dish) => dish.course !== "main" && dish.course !== "drink");

  for (const dish of mains) {
    const lead = dish.prepMinutes + dish.cookMinutes;
    steps.push({
      id: createId("step"),
      offsetMinutes: -Math.max(lead, 30),
      title: `Start ${dish.name}`,
      detail: `${dish.prepMinutes} minutes to prep, ${dish.cookMinutes} to cook. Serves ${dish.servings}.`,
      owner: "host",
    });
  }

  for (const dish of others) {
    const lead = dish.prepMinutes + dish.cookMinutes;
    steps.push({
      id: createId("step"),
      offsetMinutes: -Math.max(lead, 15),
      title: `Finish ${dish.name}`,
      detail: dish.description,
      owner: "host",
    });
  }

  steps.push(
    {
      id: createId("step"),
      offsetMinutes: -45,
      title: "Set the table",
      detail: "Water, glasses, and the seating you already argued about. Light is more important than napkins.",
      owner: "host",
    },
    {
      id: createId("step"),
      offsetMinutes: -15,
      title: "People at the door",
      detail: "Drinks in hands before coats are fully off.",
      owner: "host",
    },
    {
      id: createId("step"),
      offsetMinutes: 0,
      title: "Sit down",
      detail: "Starter on the table. Phones in another room if you can get away with it.",
      owner: "host",
    },
    {
      id: createId("step"),
      offsetMinutes: 25,
      title: "Mains",
      detail: "Bring both mains together so nobody waits on a diet.",
      owner: "host",
    },
    {
      id: createId("step"),
      offsetMinutes: 70,
      title: "Dessert and the last pot of something hot",
      detail: "Clear what you can. Leave the rest for morning.",
      owner: "host",
    },
  );

  return steps.sort((a, b) => a.offsetMinutes - b.offsetMinutes);
}

export function draftInvites(input: {
  title: string;
  date: string | null;
  startTime: string | null;
  vibe: string;
  dishes: Dish[];
  guests: Guest[];
}): string {
  const menu = input.dishes.length
    ? input.dishes.map((dish) => `• ${dish.name}`).join("\n")
    : "• Menu still being written";
  const when = [input.date, input.startTime].filter(Boolean).join(" at ") || "date coming";
  return [
    `You're invited to ${input.title || "dinner"}.`,
    when,
    input.vibe ? `The brief: ${input.vibe}.` : "",
    "",
    "On the table:",
    menu,
    "",
    "Reply with anything I should keep off the plates: allergies, no-shows, plus-ones.",
    input.guests.length ? `List so far: ${input.guests.map((guest) => guest.name).join(", ")}.` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
