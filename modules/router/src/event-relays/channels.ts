export function groupRelaysByChannel<T extends { busEvent: string }>(
  relays: T[],
): Map<string, T[]> {
  const next = new Map<string, T[]>();
  for (const relay of relays) {
    const list = next.get(relay.busEvent) ?? [];
    list.push(relay);
    next.set(relay.busEvent, list);
  }
  return next;
}

export function planChannelSubscriptions(
  currentlySubscribed: Iterable<string>,
  nextChannels: Iterable<string>,
): { toSubscribe: string[]; toUnsubscribe: string[] } {
  const current = new Set(currentlySubscribed);
  const next = new Set(nextChannels);
  return {
    toUnsubscribe: [...current].filter(channel => !next.has(channel)),
    toSubscribe: [...next].filter(channel => !current.has(channel)),
  };
}
