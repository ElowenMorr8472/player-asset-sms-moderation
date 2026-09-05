export type PlayerAsset = {
  id: string;
  playerId: string;
  title: string;
  state: "draft" | "pending_review";
};

export type LiveEvent = {
  id: string;
  submissionsOpen: boolean;
};

export type ModerationTicket = {
  id: string;
  assetId: string;
  eventId: string;
  source: "sms";
};

export type GameState = {
  playersByPhone: Map<string, string>;
  assets: Map<string, PlayerAsset>;
  events: Map<string, LiveEvent>;
  moderationQueue: ModerationTicket[];
  optedOutPhones: Set<string>;
};

export type InboundReply = {
  inboundId: string;
  from: string;
  body: string;
  eventId: string;
};

export type ReplyDecision =
  | { kind: "queued"; ticket: ModerationTicket; reply: string }
  | { kind: "opted_out" }
  | { kind: "ignored"; reason: "unknown_player" | "invalid_command" | "event_closed" | "asset_not_found" };

export function handlePlayerReply(state: GameState, input: InboundReply): ReplyDecision {
  const command = input.body.trim();
  if (command.toUpperCase() === "STOP") {
    state.optedOutPhones.add(input.from);
    return { kind: "opted_out" };
  }

  const playerId = state.playersByPhone.get(input.from);
  if (!playerId) return { kind: "ignored", reason: "unknown_player" };

  const match = /^PUBLISH\s+([A-Za-z0-9_-]+)$/i.exec(command);
  if (!match) return { kind: "ignored", reason: "invalid_command" };

  const event = state.events.get(input.eventId);
  if (!event?.submissionsOpen) return { kind: "ignored", reason: "event_closed" };

  const asset = state.assets.get(match[1]);
  if (!asset || asset.playerId !== playerId || asset.state !== "draft") {
    return { kind: "ignored", reason: "asset_not_found" };
  }

  asset.state = "pending_review";
  const ticket: ModerationTicket = {
    id: `sms-${input.inboundId}`,
    assetId: asset.id,
    eventId: event.id,
    source: "sms",
  };
  state.moderationQueue.push(ticket);
  return {
    kind: "queued",
    ticket,
    reply: `"${asset.title}" is queued for moderator review.`,
  };
}

export function createDemoState(): GameState {
  return {
    playersByPhone: new Map([["+15550001111", "player-7"]]),
    assets: new Map([["map-42", { id: "map-42", playerId: "player-7", title: "Moon Base", state: "draft" }]]),
    events: new Map([["weekend-build", { id: "weekend-build", submissionsOpen: true }]]),
    moderationQueue: [],
    optedOutPhones: new Set(),
  };
}
