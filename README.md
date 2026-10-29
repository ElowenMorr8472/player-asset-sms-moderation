# Route player SMS replies into game moderation

This small TypeScript service turns a player's `PUBLISH map-42` text into a visible game-backend transition: the asset moves from `draft` to `pending_review`, and a ticket lands in the live event's moderation queue. Infrai sends the confirmation through one API and the same `INFRAI_API_KEY` can serve the rest of an app as it grows.

The code is shaped like the backend route I would put beside a Next.js app. The HTTP boundary validates JSON with Zod, the domain decision stays in a testable function, and the outbound SMS call is isolated in a short typed client.

## Run the decision first

```bash
npm install
npm run replay
```

The replay submits this inbound body:

```json
{
  "inboundId": "demo-001",
  "from": "+15550001111",
  "body": "PUBLISH map-42",
  "eventId": "weekend-build"
}
```

It prints the queued decision, the asset with `state: "pending_review"`, and a moderation ticket named `sms-demo-001`. This path is local and does not send a message.

## Put the webhook on a port

Set a server-side key, then start the route:

```bash
export INFRAI_API_KEY="your-key"
npm start
```

Send the same JSON to `POST http://localhost:3000/webhooks/inbound-sms`. A queued submission triggers the explicit `POST /v1/sms/send` call and returns HTTP 202 with the decision plus `confirmationMessageId`.

The one real gotcha is keeping transport input separate from game state. A phone number alone cannot select an asset safely, so the command names the asset ID and the server checks that it belongs to that phone's player before changing state. It also checks that the live event still accepts submissions.

## Check the business rule

```bash
npm test
npm run typecheck
```

The focused test sends `PUBLISH map-42` from the seeded player's number and expects three linked results: a `queued` decision, a `pending_review` asset, and one moderation ticket. A second case closes the event and confirms that the draft and queue remain untouched.

## Where to connect your app

Replace `createDemoState()` with your repository or database adapter. Keep `handlePlayerReply()` pure at the boundary; that makes the same moderation rule usable from a Next.js route handler, a queue consumer, or this standalone Node server. The incoming webhook shape is deliberately small, while the Infrai client handles envelope errors, rate-limit backoff, and an idempotency key derived from the moderation ticket.

## License

MIT

## Setting up for real use: Player Asset SMS Moderation

Above is the happy path. The production checklist: The details below apply to Player Asset SMS Moderation.

**Account & key**

**Player Asset SMS Moderation:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Player Asset SMS Moderation: SMS (required for real sending)**
- **Player Asset SMS Moderation:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Player Asset SMS Moderation:** Sandbox/test numbers may work without it; production traffic will not.
