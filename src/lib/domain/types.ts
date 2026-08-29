export type Diet = "omnivore" | "vegetarian" | "vegan" | "pescatarian";

export type Course = "starter" | "main" | "side" | "dessert" | "drink";

export type TableShape = "round" | "rectangle";

export type Panel = "brief" | "guests" | "menu" | "seating" | "market" | "run";

export type Rsvp = "yes" | "maybe" | "no" | "unknown";

export type Ingredient = {
  name: string;
  qty: number;
  unit: string;
  pantry?: boolean;
  aisle: string;
  unitCost: number;
};

export type DishTemplate = {
  catalogId: string;
  course: Course;
  name: string;
  description: string;
  cuisine: string;
  diet: Diet;
  allergens: string[];
  tags: string[];
  costPerServing: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: Ingredient[];
};

export type Dish = DishTemplate & {
  id: string;
  servings: number;
  notes: string;
};

export type Guest = {
  id: string;
  name: string;
  diet: Diet;
  allergens: string[];
  avoidSeatWith: string[];
  preferSeatWith: string[];
  rsvp: Rsvp;
  notes: string;
};

export type EventBrief = {
  title: string;
  date: string | null;
  startTime: string | null;
  guestCount: number;
  budgetUsd: number | null;
  cuisine: string;
  vibe: string;
  notes: string;
};

export type Seat = {
  index: number;
  guestId: string | null;
};

export type Table = {
  shape: TableShape;
  seats: Seat[];
};

export type MarketItem = {
  id: string;
  name: string;
  qty: number;
  unit: string;
  estimatedCost: number;
  aisle: string;
  checked: boolean;
  forDishes: string[];
};

export type TimelineStep = {
  id: string;
  offsetMinutes: number;
  title: string;
  detail: string;
  owner: "host" | "agent" | "guest";
};

export type LogEntry = {
  id: string;
  at: number;
  tool: string;
  summary: string;
  source: "agent" | "human";
};

export type PendingApproval = {
  id: string;
  title: string;
  body: string;
  confirmLabel: string;
  tool: string;
};

export type Touched = {
  kind: "guest" | "dish" | "seat" | "market" | "step" | "brief";
  id: string;
  at: number;
};

export type Workspace = {
  brief: EventBrief;
  guests: Guest[];
  dishes: Dish[];
  table: Table;
  market: MarketItem[];
  timeline: TimelineStep[];
  log: LogEntry[];
  panel: Panel;
  menuLocked: boolean;
  invitesSent: boolean;
  lastTouched: Touched | null;
};

export type MenuWarning = {
  code: string;
  message: string;
};

export type SeatingIssue = {
  code: string;
  message: string;
  guestIds: string[];
};

export type MenuAnalysis = {
  estimatedCost: number;
  remainingBudget: number | null;
  dietCoverage: Record<Diet, { guests: number; mains: number; any: number }>;
  allergenConflicts: { guest: string; dish: string; allergen: string }[];
  missingCourses: Course[];
  warnings: MenuWarning[];
};
