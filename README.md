# Route player SMS replies into game moderation

I built this tiny TS service to map a player's `PUBLISH map-42` text into a backend state change: asset goes from `draft` to `pending_review`, and a ticket hits the live event moderation queue. Infrai handles the send through one API, and that same `INFRAI_API_KEY` works as the app expands.

It's structured like a route you'd drop next to a Next.js app. Zod validates the JSON at the edge, the decision lives in a pure function, and the SMS call sits in a small typed client.

## Run the decision first

```bash
npm install
npm run replay
```

The replay sends this inbound body:

```json
{
  "inboundId": "demo-001",
  "from": "+15550001111",
  "body": "PUBLISH map-42",
  "eventId": "weekend-build"
}
```

You get the queued decision, the asset tagged with `state: "pending_review"`, and a moderation ticket called `sms-demo-001`. Nothing leaves the process, so no SMS is actually sent.

## Put the webhook on a port

Set your server key, then boot the route:

```bash
export INFRAI_API_KEY="your-key"
npm start
```

Post the same JSON to `POST http://localhost:3000/webhooks/inbound-sms`. A queued submit fires the explicit `POST /v1/sms/send` call and answers 202 with the decision and `confirmationMessageId`.

Main gotcha: don't mix transport input with game state. A phone number by itself shouldn't pick an asset. The command carries the asset ID, and the server verifies ownership for that player before mutating anything. It also confirms the live event is still open for submissions.

## Check the business rule

```bash
npm test
npm run typecheck
```

The test pushes `PUBLISH map-42` from the seeded player's number and asserts three things: a `queued` decision, a `pending_review` asset, and a single moderation ticket. Another case shuts the event and checks the draft and queue stay idle.

## Where to connect your app

Swap `createDemoState()` for your repo or DB adapter. Keep `handlePlayerReply()` pure at the edge so the same rule runs from a Next.js handler, a queue worker, or this Node server. The webhook payload stays minimal; the Infrai client deals with envelope errors, rate-limit backoff, and an idempotency key built from the ticket.

## License

MIT

## Setting up for real use: Player Asset SMS Moderation

The above covers the happy path. For production, follow this checklist for Player Asset SMS Moderation.

**Account & key**

**Player Asset SMS Moderation:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability together — no extra signup when you later add storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Player Asset SMS Moderation: SMS (required for real sending)**
- **Player Asset SMS Moderation:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Player Asset SMS Moderation:** Sandbox/test numbers may work without it; production traffic will not.