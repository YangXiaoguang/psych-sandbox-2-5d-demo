import type { SandboxEvent, SandboxEventDraft } from "../types";
import { createId } from "./id";

export function createSandboxEvent(draft: SandboxEventDraft): SandboxEvent {
  return {
    id: createId("event"),
    timestamp: new Date().toISOString(),
    ...draft,
  };
}
