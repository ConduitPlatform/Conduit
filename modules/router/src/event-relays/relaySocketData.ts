import { Indexable } from '@conduitplatform/grpc-sdk';
import { RelaySubscription } from './subscriptions.js';

const CONTEXT_KEY = 'eventRelaySubs';

export function relaySubscriptionsFromContext(
  context: Indexable | undefined,
): RelaySubscription[] {
  if (!context) {
    return [];
  }
  const raw = context[CONTEXT_KEY];
  if (!Array.isArray(raw)) {
    return [];
  }
  const subs: RelaySubscription[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as RelaySubscription).relayId === 'string' &&
      typeof (item as RelaySubscription).resourceId === 'string'
    ) {
      subs.push({
        relayId: (item as RelaySubscription).relayId,
        resourceId: (item as RelaySubscription).resourceId,
      });
    }
  }
  return subs;
}

export function persistRelaySubscriptionOnContext(
  context: Indexable | undefined,
  relayId: string,
  resourceId: string,
): void {
  if (!context) {
    return;
  }
  const subs = relaySubscriptionsFromContext(context);
  const withoutDup = subs.filter(
    sub => !(sub.relayId === relayId && sub.resourceId === resourceId),
  );
  withoutDup.push({ relayId, resourceId });
  context[CONTEXT_KEY] = withoutDup;
}

export function removeRelaySubscriptionFromContext(
  context: Indexable | undefined,
  relayId: string,
  resourceId: string,
): void {
  if (!context) {
    return;
  }
  const next = relaySubscriptionsFromContext(context).filter(
    sub => !(sub.relayId === relayId && sub.resourceId === resourceId),
  );
  if (next.length === 0) {
    delete context[CONTEXT_KEY];
  } else {
    context[CONTEXT_KEY] = next;
  }
}
