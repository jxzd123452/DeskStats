import type { Sample } from "../types";

export type LiveMessage =
  | { type: "hello" }
  | { type: "seed"; history: Sample[] }
  | { type: "sample"; sample: Sample };

type Handler = (message: LiveMessage) => void;

let channel: BroadcastChannel | null | undefined;
const handlers = new Set<Handler>();

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  try {
    channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("deskstats-live") : null;
  } catch {
    channel = null;
  }
  if (channel) {
    channel.onmessage = (event: MessageEvent<LiveMessage>) => {
      const data = event.data;
      if (!data || typeof data !== "object" || !("type" in data)) return;
      for (const handler of handlers) handler(data);
    };
  }
  return channel;
}

export function publishLive(message: LiveMessage) {
  getChannel()?.postMessage(message);
}

export function subscribeLive(handler: Handler): () => void {
  getChannel();
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}
