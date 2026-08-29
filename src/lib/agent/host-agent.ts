import { planCalls } from "./intents";
import type { ModelContext } from "@/lib/webmcp/types";

export type AgentStep = {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  error?: string;
};

function parseResult(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function summarize(steps: AgentStep[]): string {
  if (!steps.length) return "I can plan dinner, lock the menu, or send invites.";
  const lines: string[] = [];
  for (const step of steps) {
    if (step.error) {
      lines.push(`${step.name} failed: ${step.error}`);
      continue;
    }
    const payload = step.result as { ok?: boolean; error?: string; rationale?: string } | null;
    if (payload && typeof payload === "object" && payload.error) {
      lines.push(payload.error);
      continue;
    }
    switch (step.name) {
      case "set_event_brief":
        lines.push("I wrote the brief. Date, budget, and the shape of the night.");
        break;
      case "add_guest":
        lines.push(`Added ${(step.args.name as string) ?? "a guest"} to the list.`);
        break;
      case "propose_menu":
        lines.push(
          payload && typeof payload === "object" && payload.rationale
            ? payload.rationale
            : "I put a menu on the table.",
        );
        break;
      case "substitute_dish":
        lines.push("I swapped a dish and left the rest of the menu standing.");
        break;
      case "generate_shopping_list":
        lines.push("The market list is rebuilt from whatever is actually on the menu.");
        break;
      case "auto_seat":
        lines.push("I sat people using the avoid and prefer notes.");
        break;
      case "generate_run_of_show":
        lines.push("There is a run of show working backward from sit-down.");
        break;
      case "lock_menu":
        lines.push(
          payload && typeof payload === "object" && payload.ok
            ? "The menu is locked."
            : "The menu stayed unlocked.",
        );
        break;
      case "send_invites":
        lines.push(
          payload && typeof payload === "object" && payload.ok
            ? "Invites went out."
            : "Invites stayed in the drawer.",
        );
        break;
      case "get_workspace_state": {
        const snap = step.result as {
          brief?: { title?: string };
          guests?: unknown[];
          dishes?: unknown[];
          menuLocked?: boolean;
        } | null;
        const title = snap?.brief?.title || "Untitled dinner";
        const guests = Array.isArray(snap?.guests) ? snap.guests.length : 0;
        const dishes = Array.isArray(snap?.dishes) ? snap.dishes.length : 0;
        lines.push(
          snap?.menuLocked
            ? `${title} is locked. ${guests} guests, ${dishes} dishes.`
            : `${title} is open. ${guests} guests, ${dishes} dishes. Say book it to lock the menu.`,
        );
        break;
      }
      default:
        break;
    }
  }
  const unique = [...new Set(lines.filter(Boolean))];
  return unique.join(" ") || "Done. Watch the studio. That is the source of truth.";
}

export async function runHostAgent(
  prompt: string,
  ctx: ModelContext,
  onStep?: (step: AgentStep) => void,
): Promise<{ reply: string; steps: AgentStep[] }> {
  const tools = await ctx.getTools();
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const planned = planCalls(prompt);
  const steps: AgentStep[] = [];

  for (const call of planned) {
    const tool = byName.get(call.name);
    if (!tool) {
      const missed: AgentStep = {
        name: call.name,
        args: call.args,
        result: null,
        error: `Tool ${call.name} is not registered on this page.`,
      };
      steps.push(missed);
      onStep?.(missed);
      continue;
    }
    try {
      const raw = await ctx.executeTool(tool, JSON.stringify(call.args));
      const step: AgentStep = {
        name: call.name,
        args: call.args,
        result: parseResult(raw),
      };
      steps.push(step);
      onStep?.(step);
      const payload = step.result as { ok?: boolean } | null;
      if (payload && typeof payload === "object" && payload.ok === false) {
        break;
      }
    } catch (error) {
      const step: AgentStep = {
        name: call.name,
        args: call.args,
        result: null,
        error: error instanceof Error ? error.message : "Tool failed.",
      };
      steps.push(step);
      onStep?.(step);
      break;
    }
  }

  return { reply: summarize(steps), steps };
}

export const SUGGESTED_PROMPTS = [
  "Plan Saturday dinner for 8 — two vegan, Maya has a nut allergy, $90, Italian, warm and unfussy",
  "Seat Maya away from Tom and put the two vegans together",
  "Swap the pasta for something gluten-free and rebuild the market list",
  "Build a 4-hour run of show starting at 7pm, then lock the menu",
  "Draft invites and send them",
] as const;
