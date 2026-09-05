import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { infrai, InfraiError } from "./infrai_sms.js";
import { createDemoState, handlePlayerReply } from "./player_asset_moderation.js";

const inboundSmsSchema = z.object({
  inboundId: z.string().min(1),
  from: z.string().regex(/^\+[1-9]\d{7,14}$/),
  body: z.string().min(1).max(160),
  eventId: z.string().min(1),
}).strict();

const state = createDemoState();

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/webhooks/inbound-sms") {
    json(response, 404, { error: "not_found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const parsed = inboundSmsSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) {
      json(response, 400, { error: "invalid_inbound_sms", issues: parsed.error.flatten() });
      return;
    }

    const decision = handlePlayerReply(state, parsed.data);
    if (decision.kind !== "queued") {
      json(response, 200, { decision });
      return;
    }

    const delivery = await infrai.sms.send({
      to: parsed.data.from,
      body: decision.reply,
      idempotency_key: decision.ticket.id,
    });
    json(response, 202, { decision, confirmationMessageId: delivery.message_id });
  } catch (error) {
    if (error instanceof SyntaxError) {
      json(response, 400, { error: "invalid_json" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    json(response, 500, { error: "server_error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Inbound SMS route listening on http://localhost:${port}`));
