import { createDemoState, handlePlayerReply } from "../src/player_asset_moderation.js";

const state = createDemoState();
const decision = handlePlayerReply(state, {
  inboundId: "demo-001",
  from: "+15550001111",
  body: "PUBLISH map-42",
  eventId: "weekend-build",
});

console.log(JSON.stringify({
  decision,
  asset: state.assets.get("map-42"),
  moderationQueue: state.moderationQueue,
}, null, 2));
