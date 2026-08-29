"use client";

import { useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { runHostAgent, SUGGESTED_PROMPTS } from "@/lib/agent/host-agent";
import type { AgentStep } from "@/lib/agent/host-agent";
import type { ModelContext, RegisteredTool } from "@/lib/webmcp/types";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "agent";
  text: string;
  steps?: AgentStep[];
};

type AgentDeskProps = {
  ctx: ModelContext | null;
  native: boolean;
  tools: RegisteredTool[];
};

export function AgentDesk({ ctx, native, tools }: AgentDeskProps) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [inspector, setInspector] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "hello",
      role: "agent",
      text: "I am the sous-chef on this page. I only act through WebMCP tools — the same ones ChatGPT and Chrome see. Give me a night, a budget, and the people who cannot sit together.",
    },
  ]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !ctx || busy) return;
    setPrompt("");
    setBusy(true);
    const user: Message = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    const agentId = `a-${Date.now()}`;
    setMessages((current) => [
      ...current,
      user,
      { id: agentId, role: "agent", text: "Working the table…", steps: [] },
    ]);

    try {
      const { reply, steps } = await runHostAgent(trimmed, ctx, (step) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === agentId
              ? { ...message, steps: [...(message.steps ?? []), step] }
              : message,
          ),
        );
      });
      setMessages((current) =>
        current.map((message) =>
          message.id === agentId ? { ...message, text: reply, steps } : message,
        ),
      );
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === agentId
            ? {
                ...message,
                text: error instanceof Error ? error.message : "The sous-chef stalled.",
              }
            : message,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="flex h-full min-h-0 flex-col bg-card/70">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="font-display text-xl leading-none">Sous-chef</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Same tools as ChatGPT. Same table as you.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={native ? "default" : "secondary"}>
            {native ? "Native WebMCP" : "Polyfill"}
          </Badge>
          <button
            type="button"
            className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setInspector((value) => !value)}
          >
            {tools.length} tools
          </button>
        </div>
      </div>

      {inspector ? (
        <ScrollArea className="h-40 border-b border-border">
          <ul className="space-y-2 p-3">
            {tools.map((tool) => (
              <li key={tool.name} className="text-xs">
                <p className="font-mono text-[11px]">{tool.name}</p>
                <p className="text-muted-foreground">{tool.description}</p>
              </li>
            ))}
          </ul>
        </ScrollArea>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-xl px-3 py-2 text-sm leading-6",
                message.role === "user"
                  ? "ml-6 bg-primary text-primary-foreground"
                  : "mr-4 bg-muted/70",
              )}
            >
              <p>{message.text}</p>
              {message.steps?.length ? (
                <ol className="mt-2 space-y-1 border-t border-foreground/10 pt-2 font-mono text-[10px] opacity-80">
                  {message.steps.map((step, index) => (
                    <li key={`${step.name}-${index}`}>
                      {step.name}
                      {step.error ? ` — ${step.error}` : ""}
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
          {SUGGESTED_PROMPTS.map((item) => (
            <button
              key={item}
              type="button"
              disabled={busy || !ctx}
              onClick={() => void send(item)}
              className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-left text-[11px] leading-4 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {item}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(prompt);
          }}
        >
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Plan Saturday for eight…"
            rows={2}
            className="min-h-[52px] resize-none"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(prompt);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={busy || !ctx || !prompt.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </aside>
  );
}
