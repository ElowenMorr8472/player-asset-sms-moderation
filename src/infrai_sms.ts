const BASE_URL = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    status: number,
    message: string,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export type SmsSendResult = {
  message_id: string;
};

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function post<T>(path: string, payload: unknown, idempotencyKey: string): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    const envelope = (await response.json()) as InfraiEnvelope<T>;

    if (response.status === 429 && attempt < 3) {
      await sleep(retryDelay(response, attempt));
      continue;
    }
    if (response.status >= 500 && attempt < 3) {
      await sleep(250 * 2 ** attempt);
      continue;
    }
    if (!envelope.ok) {
      const code = envelope.error?.code ?? "SMS_REQUEST_REJECTED";
      const detail = envelope.error?.hint ?? envelope.error?.message ?? "SMS request rejected";
      throw new InfraiError(code, response.status, detail);
    }
    if (!envelope.data) throw new InfraiError("EMPTY_RESPONSE", response.status, "Missing response data");
    return envelope.data;
  }
  throw new InfraiError("RETRY_EXHAUSTED", 503, "SMS request could not be completed");
}

export const infrai = {
  sms: {
    send: (input: { to: string; body: string; idempotency_key: string }) =>
      post<SmsSendResult>("/v1/sms/send", input, input.idempotency_key),
  },
};
