"use client";

import { useEffect, useState } from "react";
import { useStudioStore } from "@/lib/domain/store";
import { ensureModelContext, isNativeModelContext } from "@/lib/webmcp/polyfill";
import { CORE_TOOLS, lensTools } from "@/lib/webmcp/tools";
import type { ModelContext, RegisteredTool } from "@/lib/webmcp/types";

export function useWebMcpTools() {
  const panel = useStudioStore((state) => state.panel);
  const [ctx, setCtx] = useState<ModelContext | null>(null);
  const [native, setNative] = useState(false);
  const [tools, setTools] = useState<RegisteredTool[]>([]);

  useEffect(() => {
    const model = ensureModelContext();
    const usingNative = isNativeModelContext();
    queueMicrotask(() => {
      setCtx(model);
      setNative(usingNative);
    });
    if (!model) return;

    const refresh = async () => {
      try {
        setTools(await model.getTools());
      } catch {
        setTools([]);
      }
    };

    const onChange = () => {
      void refresh();
    };
    model.addEventListener("toolchange", onChange);
    void refresh();
    return () => model.removeEventListener("toolchange", onChange);
  }, []);

  useEffect(() => {
    if (!ctx) return;
    const controller = new AbortController();
    void Promise.all(
      CORE_TOOLS.map((tool) => ctx.registerTool(tool, { signal: controller.signal })),
    );
    return () => controller.abort();
  }, [ctx]);

  useEffect(() => {
    if (!ctx) return;
    const controller = new AbortController();
    const extras = lensTools(panel);
    void Promise.all(
      extras.map((tool) => ctx.registerTool(tool, { signal: controller.signal })),
    );
    return () => controller.abort();
  }, [ctx, panel]);

  return { ctx, native, tools };
}
