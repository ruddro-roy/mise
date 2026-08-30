"use client";

import { useCallback, useEffect, useState } from "react";
import { useStudioStore } from "@/lib/domain/store";
import {
  ensureModelContext,
  isNativeModelContext,
  subscribeToToolChanges,
} from "@/lib/webmcp/polyfill";
import { CORE_TOOLS, lensTools } from "@/lib/webmcp/tools";
import type { ModelContext, RegisteredTool } from "@/lib/webmcp/types";

export function useWebMcpTools() {
  const panel = useStudioStore((state) => state.panel);
  const [ctx, setCtx] = useState<ModelContext | null>(null);
  const [native, setNative] = useState(false);
  const [tools, setTools] = useState<RegisteredTool[]>([]);

  const refreshTools = useCallback(async (model: ModelContext) => {
    try {
      setTools(await model.getTools());
    } catch {
      setTools([]);
    }
  }, []);

  useEffect(() => {
    const model = ensureModelContext();
    const usingNative = isNativeModelContext();
    setCtx(model);
    setNative(usingNative);
    if (!model) return;

    const onChange = () => {
      void refreshTools(model);
    };
    const unsubscribe = subscribeToToolChanges(model, onChange);
    void refreshTools(model);
    return unsubscribe;
  }, [refreshTools]);

  useEffect(() => {
    if (!ctx) return;
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        await Promise.all(
          CORE_TOOLS.map((tool) => ctx.registerTool(tool, { signal: controller.signal })),
        );
      } catch {
        // Some native implementations reject duplicate registrations during reloads.
      } finally {
        if (active) void refreshTools(ctx);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [ctx, refreshTools]);

  useEffect(() => {
    if (!ctx) return;
    const controller = new AbortController();
    const extras = lensTools(panel);
    let active = true;
    void (async () => {
      try {
        await Promise.all(
          extras.map((tool) => ctx.registerTool(tool, { signal: controller.signal })),
        );
      } catch {
        // Keep the studio usable even if one optional lens tool is unavailable.
      } finally {
        if (active) void refreshTools(ctx);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [ctx, panel, refreshTools]);

  return { ctx, native, tools };
}
