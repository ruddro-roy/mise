import type { Diet } from "./types";

const RANK: Record<Diet, number> = {
  vegan: 0,
  vegetarian: 1,
  pescatarian: 2,
  omnivore: 3,
};

export function dishFeedsDiet(dishDiet: Diet, guestDiet: Diet): boolean {
  return RANK[dishDiet] <= RANK[guestDiet];
}

export function normalizeAllergen(value: string): string {
  const raw = value.trim().toLowerCase();
  if (raw === "nut" || raw === "nuts" || raw === "tree nut" || raw === "tree nuts") {
    return "nuts";
  }
  if (raw === "peanut" || raw === "peanuts") return "peanuts";
  if (raw === "gluten" || raw === "wheat" || raw === "gluten-free") return "gluten";
  if (raw === "dairy" || raw === "milk" || raw === "lactose") return "dairy";
  if (raw === "egg" || raw === "eggs") return "eggs";
  if (raw === "shellfish" || raw === "shrimp") return "shellfish";
  if (raw === "soy" || raw === "soya") return "soy";
  if (raw === "sesame") return "sesame";
  if (raw === "fish") return "fish";
  return raw;
}

export const KNOWN_ALLERGENS = [
  "nuts",
  "peanuts",
  "gluten",
  "dairy",
  "eggs",
  "shellfish",
  "soy",
  "sesame",
  "fish",
] as const;
