import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { EventRelay } from '../models/index.js';
import {
  EVENT_RELAY_REFRESH_CHANNEL,
  EVENT_RELAY_SUBSCRIBER_PREFIX,
} from './constants.js';
import { groupRelaysByChannel, planChannelSubscriptions } from './channels.js';
import { buildRelayEmissions, parseBusPayload } from './process.js';
import { EventRelayPusher } from './push.js';

export type { EventRelayPusher } from './push.js';
export { createEventRelayPusher } from './push.js';

export class EventRelayManager {
  private readonly relaysByChannel = new Map<string, EventRelay[]>();
  private readonly subscribedChannels = new Set<string>();
  private started = false;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly push: EventRelayPusher,
  ) {}

  async start(): Promise<void> {
    if (!this.started) {
      this.grpcSdk.bus?.subscribe(
        EVENT_RELAY_REFRESH_CHANNEL,
        () => {
          this.reconcile().catch(err => {
            ConduitGrpcSdk.Logger.error(err as Error);
          });
        },
        'router-event-relays-refresh',
      );
      this.started = true;
    }
    await this.reconcile();
  }

  async stop(): Promise<void> {
    for (const channel of [...this.subscribedChannels]) {
      this.grpcSdk.bus?.unsubscribe(`${EVENT_RELAY_SUBSCRIBER_PREFIX}${channel}`);
      this.subscribedChannels.delete(channel);
    }
    this.relaysByChannel.clear();
    if (this.started) {
      this.grpcSdk.bus?.unsubscribe('router-event-relays-refresh');
      this.started = false;
    }
  }

  async notifyChanged(): Promise<void> {
    if (this.started) {
      await this.reconcile();
    }
    this.grpcSdk.bus?.publish(EVENT_RELAY_REFRESH_CHANNEL, '');
  }

  async reconcile(): Promise<void> {
    const relays = await EventRelay.getInstance().findMany({ active: true });
    const next = groupRelaysByChannel(relays);
    const { toSubscribe, toUnsubscribe } = planChannelSubscriptions(
      this.subscribedChannels,
      next.keys(),
    );

    this.relaysByChannel.clear();
    for (const [channel, list] of next) {
      this.relaysByChannel.set(channel, list);
    }

    for (const channel of toUnsubscribe) {
      this.grpcSdk.bus?.unsubscribe(`${EVENT_RELAY_SUBSCRIBER_PREFIX}${channel}`);
      this.subscribedChannels.delete(channel);
    }

    for (const channel of toSubscribe) {
      this.grpcSdk.bus?.subscribe(
        channel,
        message => this.onBusMessage(channel, message),
        `${EVENT_RELAY_SUBSCRIBER_PREFIX}${channel}`,
      );
      this.subscribedChannels.add(channel);
    }
  }

  getActiveRelay(id: string): EventRelay | undefined {
    for (const relays of this.relaysByChannel.values()) {
      const match = relays.find(relay => relay._id === id);
      if (match) return match;
    }
    return undefined;
  }

  private onBusMessage(channel: string, message: string): void {
    const relays = this.relaysByChannel.get(channel);
    if (!relays || relays.length === 0) {
      return;
    }

    let payload: unknown;
    try {
      payload = parseBusPayload(message);
    } catch (err) {
      ConduitGrpcSdk.Metrics?.increment('event_relays_failed_total');
      ConduitGrpcSdk.Logger.error(
        `Event relay failed to parse payload for ${channel}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return;
    }

    const { emissions, failures } = buildRelayEmissions(relays, payload);
    for (const failure of failures) {
      ConduitGrpcSdk.Metrics?.increment('event_relays_failed_total');
      ConduitGrpcSdk.Logger.warn(
        `Event relay ${failure.relayId} skipped on ${failure.busEvent}: ${failure.reason}`,
      );
    }

    for (const emission of emissions) {
      this.push(emission.socketEvent, emission.data, [emission.room]).then(
        () => {
          ConduitGrpcSdk.Metrics?.increment('event_relays_emitted_total');
        },
        err => {
          ConduitGrpcSdk.Metrics?.increment('event_relays_failed_total');
          ConduitGrpcSdk.Logger.error(
            `Event relay ${emission.relayId} emit failed on ${channel}: ${
              (err as Error).message
            }`,
          );
        },
      );
    }
  }
}
