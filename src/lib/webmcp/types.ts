export type JsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

export type ToolExecuteExtras = {
  signal?: AbortSignal;
};

export type ToolDefinition = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  execute: (input: Record<string, unknown>, extras: ToolExecuteExtras) => Promise<unknown> | unknown;
};

export type RegisterToolOptions = {
  signal?: AbortSignal;
  exposedTo?: string[];
};

export type RegisteredTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: ToolAnnotations;
  origin: string;
  window?: Window;
};

export type ModelContext = {
  registerTool: (definition: ToolDefinition, options?: RegisterToolOptions) => Promise<void>;
  getTools: (options?: { fromOrigins?: string[] }) => Promise<RegisteredTool[]>;
  executeTool: (
    tool: RegisteredTool,
    argsJson: string,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>;
  addEventListener?: (
    type: "toolchange",
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener?: (
    type: "toolchange",
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) => void;
  ontoolchange: ((event: Event) => void) | null;
};

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}
