import { describe, expect, it } from "vitest";
import { extractPlanSlots, planCalls } from "./intents";

describe("extractPlanSlots", () => {
  it("reads the Saturday Italian brief", () => {
    const slots = extractPlanSlots(
      "Plan Saturday dinner for 8 — two vegan, Maya has a nut allergy, $90, Italian, warm and unfussy",
    );
    expect(slots.guestCount).toBe(8);
    expect(slots.budgetUsd).toBe(90);
    expect(slots.cuisine).toBe("italian");
    expect(slots.veganCount).toBe(2);
    expect(slots.namedGuests[0]).toMatchObject({ name: "Maya", allergens: ["nuts"] });
    expect(slots.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("planCalls", () => {
  it("plans a full table from one sentence", () => {
    const calls = planCalls(
      "Plan Saturday dinner for 8 — two vegan, Maya has a nut allergy, $90, Italian, warm and unfussy",
    );
    const names = calls.map((call) => call.name);
    expect(names).toContain("set_event_brief");
    expect(names).toContain("add_guest");
    expect(names).toContain("propose_menu");
    expect(names).toContain("generate_shopping_list");
    expect(names).toContain("auto_seat");
    expect(calls.filter((call) => call.name === "add_guest")).toHaveLength(8);
  });

  it("links vegans and reseats", () => {
    const calls = planCalls("Seat Maya away from Tom and put the two vegans together");
    expect(calls.map((call) => call.name)).toEqual(
      expect.arrayContaining([
        "update_guest",
        "link_guests_by_diet",
        "auto_seat",
      ]),
    );
  });

  it("swaps pasta and rebuilds the market", () => {
    const calls = planCalls(
      "Swap the pasta for something gluten-free and rebuild the market list",
    );
    expect(calls[0]).toMatchObject({
      name: "substitute_dish",
      args: { name: "cacio", constraint: "gluten-free" },
    });
    expect(calls.some((call) => call.name === "generate_shopping_list")).toBe(true);
  });
});
