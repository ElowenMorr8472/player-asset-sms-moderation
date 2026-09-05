import assert from "node:assert/strict";
import test from "node:test";
import { createDemoState, handlePlayerReply } from "../src/player_asset_moderation.js";

test("PUBLISH moves the player's draft into the live event moderation queue", () => {
  const state = createDemoState();
  const result = handlePlayerReply(state, {
    inboundId: "reply-88",
    from: "+15550001111",
    body: "PUBLISH map-42",
    eventId: "weekend-build",
  });

  assert.equal(result.kind, "queued");
  assert.equal(state.assets.get("map-42")?.state, "pending_review");
  assert.deepEqual(state.moderationQueue, [{
    id: "sms-reply-88",
    assetId: "map-42",
    eventId: "weekend-build",
    source: "sms",
  }]);
});

test("a closed live event leaves the asset as a draft", () => {
  const state = createDemoState();
  state.events.get("weekend-build")!.submissionsOpen = false;

  const result = handlePlayerReply(state, {
    inboundId: "reply-89",
    from: "+15550001111",
    body: "PUBLISH map-42",
    eventId: "weekend-build",
  });

  assert.deepEqual(result, { kind: "ignored", reason: "event_closed" });
  assert.equal(state.assets.get("map-42")?.state, "draft");
  assert.equal(state.moderationQueue.length, 0);
});
