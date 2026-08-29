import { describe, expect, it } from "vitest";
import { getDishByCatalogId } from "./catalog";
import { nextWeekday } from "./format";
import { createId } from "./ids";
import {
  analyzeMenu,
  autoSeat,
  buildRunOfShow,
  buildShoppingList,
  instantiateDish,
  proposeMenu,
  seatingIssues,
  substituteDish,
} from "./planner";
import type { Guest } from "./types";

function guest(name: string, diet: Guest["diet"], allergens: string[] = []): Guest {
  return {
    id: createId("guest"),
    name,
    diet,
    allergens,
    avoidSeatWith: [],
    preferSeatWith: [],
    rsvp: "yes",
    notes: "",
  };
}

describe("proposeMenu", () => {
  it("keeps nuts off a family-style Italian table and feeds vegans", () => {
    const maya = guest("Maya", "omnivore", ["nuts"]);
    const priya = guest("Priya", "vegan");
    const noor = guest("Noor", "vegan");
    const { dishes, warnings } = proposeMenu({
      cuisine: "italian",
      guestCount: 8,
      budgetUsd: 90,
      guests: [maya, priya, noor, guest("Tom", "omnivore")],
    });

    expect(dishes.length).toBeGreaterThan(3);
    expect(dishes.every((dish) => !dish.allergens.includes("nuts"))).toBe(true);
    expect(dishes.some((dish) => dish.course === "main" && dish.diet === "vegan")).toBe(
      true,
    );
    expect(dishes.some((dish) => dish.cuisine === "italian")).toBe(true);
    const analysis = analyzeMenu(dishes, [maya, priya, noor], 90);
    expect(analysis.allergenConflicts).toHaveLength(0);
    expect(warnings.join(" ")).not.toMatch(/Could not find a vegan main/);
  });
});

describe("substituteDish", () => {
  it("swaps pasta for a gluten-free main", () => {
    const guests = [guest("Tom", "omnivore", ["gluten"])];
    const pasta = getDishByCatalogId("cacio-e-pepe");
    expect(pasta).toBeTruthy();
    const withPasta = [instantiateDish(pasta!, 6)];
    const result = substituteDish(withPasta, "cacio", "gluten-free", 6, guests);
    expect(result.error).toBeUndefined();
    expect(result.added?.allergens.includes("gluten")).toBe(false);
    expect(result.added?.tags.includes("gluten-free")).toBe(true);
  });
});

describe("autoSeat", () => {
  it("honors an avoid pair when it can", () => {
    const maya = guest("Maya", "omnivore");
    const tom = guest("Tom", "omnivore");
    const priya = guest("Priya", "vegan");
    const noor = guest("Noor", "vegan");
    maya.avoidSeatWith = [tom.id];
    tom.avoidSeatWith = [maya.id];
    priya.preferSeatWith = [noor.id];
    noor.preferSeatWith = [priya.id];
    const seats = autoSeat([maya, tom, priya, noor], "round");
    const issues = seatingIssues(seats, [maya, tom, priya, noor]);
    expect(issues.filter((issue) => issue.code === "avoid")).toHaveLength(0);
  });
});

describe("lists", () => {
  it("builds a market list without pantry staples and a backward run of show", () => {
    const { dishes } = proposeMenu({
      cuisine: "italian",
      guestCount: 8,
      budgetUsd: 90,
      guests: [guest("Maya", "omnivore", ["nuts"])],
    });
    const market = buildShoppingList(dishes);
    expect(market.length).toBeGreaterThan(4);
    expect(market.every((item) => item.aisle !== "pantry")).toBe(true);
    const timeline = buildRunOfShow(dishes, "19:00", 4);
    expect(timeline[0]?.offsetMinutes).toBeLessThan(0);
    expect(timeline.some((step) => step.offsetMinutes === 0)).toBe(true);
  });
});

describe("format", () => {
  it("returns the next named weekday, not today", () => {
    const friday = new Date(2026, 7, 28);
    expect(nextWeekday("saturday", friday)).toBe("2026-08-29");
  });
});
