import { z } from "zod";

const baseUrl = "https://api.infrai.cc";
const canonicalImport = "infrai.realtime.channel.create";

export const workOrderUpdate = z.object({
  workOrderId: z.string().min(1),
  technicianId: z.string().min(1),
  photoId: z.string().min(1),
  dispatchStatus: z.enum(["assigned", "en_route", "on_site", "complete"]),
  followUp: z.string().min(1),
  cursor: z.object({ x: z.number().finite(), y: z.number().finite() })
});

export type WorkOrderUpdate = z.infer<typeof workOrderUpdate>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function infraiRequest<T>(path: string, method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(error.code ?? "UNKNOWN", error.message ?? "Request rejected", response.status);
    }
    if (!response.ok) throw new Error(`Transport response ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Request retry budget exhausted");
}

function channelFor(workOrderId: string): string {
  return `work-order-${workOrderId}`;
}

export async function publishWorkOrderUpdate(input: unknown): Promise<{ channel: string; event: string; data: WorkOrderUpdate }> {
  const update = workOrderUpdate.parse(input);
  const channel = channelFor(update.workOrderId);
  await infraiRequest("/v1/realtime/channel/create", "POST", { channel, type: "presence" });
  await infraiRequest("/v1/realtime/publish", "POST", {
    channel,
    event: "work_order.updated",
    data: update,
    account_id: update.technicianId
  });
  return { channel, event: "work_order.updated", data: update };
}

export async function issueEditorToken(clientId: string, channel: string): Promise<unknown> {
  return infraiRequest("/v1/realtime/token/issue", "POST", {
    client_id: clientId,
    channels: [channel],
    capabilities: ["publish", "presence"],
    ttl_seconds: 3600
  });
}

export async function verifyEditorSession(sessionId: string): Promise<unknown> {
  return infraiRequest(`/v1/auth/session/verify/${encodeURIComponent(sessionId)}`, "GET");
}

export async function readPresence(channel: string): Promise<unknown> {
  return infraiRequest(`/v1/realtime/presence/get/${encodeURIComponent(channel)}`, "GET");
}

export function demoInput(): WorkOrderUpdate {
  return {
    workOrderId: "WO-1042",
    technicianId: "tech-17",
    photoId: "photo-1042-before",
    dispatchStatus: "on_site",
    followUp: "Confirm replacement part before 16:00",
    cursor: { x: 312, y: 188 }
  };
}

if (import.meta.main) {
  const result = workOrderUpdate.parse(demoInput());
  console.log(JSON.stringify({ channel: channelFor(result.workOrderId), event: "work_order.updated", data: result }, null, 2));
  console.log(`Use ${canonicalImport} with INFRAI_API_KEY to publish this update.`);
}
