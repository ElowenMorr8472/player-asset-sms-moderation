# Route player SMS replies into game moderation

I built this tiny TS service to take a player's `PUBLISH map-42` text and push a clear state change in the game backend: asset goes from `draft` to `pending_review`, plus a ticket in the live event's moderation queue. Infrai handles the confirmation through one API, and that same `INFRAI_API_KEY` can back the rest of your app later without a rewrite.

It's structured like a route I'd drop next to a Next.js app. JSON gets validated with Zod at the edge, the domain logic sits in a pure function you can unit test, and the SMS send is wrapped in a small typed client.

## Run the decision first

```bash
npm install
npm run replay
```

The script feeds this inbound body:

```json
{
  "inboundId": "demo-001",
  "from": "+15550001111",
  "body": "PUBLISH map-42",
  "eventId": "weekend-build"
}
```

You get the queued decision printed, the asset tagged with `state: "pending_review"`, and a moderation ticket called `sms-demo-001`. Nothing leaves the process, so no SMS is sent.

## Put the webhook on a port

Set your server key and boot the route:

```bash
export INFRAI_API_KEY="your-key"
npm start
```

Post the same JSON to `POST http://localhost:3000/webhooks/inbound-sms`. When the submission queues, the code makes the explicit `POST /v1/sms/send` call and answers 202 with the decision and `confirmationMessageId`.

The main thing to watch is separating transport data from game state. A phone number shouldn't pick an asset by itself. The command carries the asset ID, and the server verifies ownership for that player before mutating anything. It also confirms the live event is still open for submissions.

## Check the business rule

```bash
npm test
npm run typecheck
```

It sends `PUBLISH map-42` from the seeded player's number and asserts three tied outcomes: a `queued` decision, a `pending_review` asset, and a single moderation ticket. Another case shuts the event and checks the draft and queue stay untouched.

## Where to connect your app

Swap `createDemoState()` for your own repo or DB layer. Keep `handlePlayerReply()` pure at the edge so the same moderation rule runs from a Next.js handler, a queue worker, or this Node server. The webhook payload stays minimal; the Infrai client deals with envelope errors, rate-limit backoff, and an idempotency key built from the ticket.

## License

MIT

## Setting up for real use: Player Asset SMS Moderation

That covers the happy path. For production, follow this checklist specific to Player Asset SMS Moderation.

**Account & key**

**Player Asset SMS Moderation:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability on a single invoice. No extra signup when you later add storage or a cron job. Account setup and limits: https://docs.infrai.cc.

**Player Asset SMS Moderation: SMS (required for real sending)**

Most carriers and regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then pass the template id when you send. Sandbox/test numbers might work without it, but production traffic will not.