import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { EventRelay } from '../models/index.js';
import {
  EVENT_RELAY_REFRESH_CHANNEL,
  EVENT_RELAY_SUBSCRIBER_PREFIX,
  RECONCILE_INTERVAL_MS,
  RELAY_REBAC_TTL_MS,
} from './constants.js';
import { groupRelaysByChannel, planChannelSubscriptions } from './channels.js';
import { parseBusPayload } from './process.js';
import { EventRelayPusher } from './push.js';
import { compileRelay, CompiledRelay } from './compile.js';
import { RelayRebacCache } from './rebacCache.js';
import { eventRelayRoomPrefix } from './rooms.js';

export type { EventRelayPusher } from './push.js';
export { createEventRelayPusher } from './push.js';

export type EventRelaySocketAccess = {
  getLocalRoomUserIds: (room: string) => Promise<string[]>;
  getLocalRoomsWithPrefix: (prefix: string) => Promise<string[]>;
};

export class EventRelayManager {
  private readonly relaysById = new Map<string, EventRelay>();
  private readonly relaysByChannel = new Map<string, CompiledRelay[]>();
  private readonly subscribedChannels = new Set<string>();
  private readonly rebacCache = new RelayRebacCache(RELAY_REBAC_TTL_MS);
  private started = false;
  private reconcilePending = false;
  private reconciling = false;
  private reconcileTimer?: NodeJS.Timeout;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly push: EventRelayPusher,
    private readonly sockets: EventRelaySocketAccess,
  ) {}

  async start(): Promise<void> {
    if (!this.started) {
      this.grpcSdk.bus?.subscribe(
        EVENT_RELAY_REFRESH_CHANNEL,
        () => {
          void this.reconcile();
        },
        'router-event-relays-refresh',
      );
      this.reconcileTimer = setInterval(() => {
        void this.reconcile();
      }, RECONCILE_INTERVAL_MS);
      this.started = true;
    }
    await this.reconcile();
  }

  async stop(): Promise<void> {
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer);
      this.reconcileTimer = undefined;
    }
    for (const channel of [...this.subscribedChannels]) {
      this.grpcSdk.bus?.unsubscribe(`${EVENT_RELAY_SUBSCRIBER_PREFIX}${channel}`);
      this.subscribedChannels.delete(channel);
    }
    this.relaysByChannel.clear();
    this.relaysById.clear();
    this.rebacCache.clear();
    if (this.started) {
      this.grpcSdk.bus?.unsubscribe('router-event-relays-refresh');
      this.started = false;
    }
    ConduitGrpcSdk.Metrics?.set('event_relays_active_total', 0);
    ConduitGrpcSdk.Metrics?.set('event_relays_subscribed_channels_total', 0);
  }

  async notifyChanged(options?: { evictRelayIds?: string[] }): Promise<void> {
    if (options?.evictRelayIds?.length) {
      for (const relayId of options.evictRelayIds) {
        await this.evictRelayRooms(relayId);
      }
    }
    if (this.started) {
      await this.reconcile();
    }
    this.grpcSdk.bus?.publish(EVENT_RELAY_REFRESH_CHANNEL, '');
  }

  async evictRelayRooms(relayId: string): Promise<void> {
    const prefix = eventRelayRoomPrefix(relayId);
    const rooms = await this.sockets.getLocalRoomsWithPrefix(prefix);
    if (rooms.length === 0) {
      return;
    }
    await this.push('leave-room', undefined, rooms);
  }

  getActiveRelay(id: string): EventRelay | undefined {
    return this.relaysById.get(id);
  }

  async reconcile(): Promise<void> {
    this.reconcilePending = true;
    if (this.reconciling) {
      return;
    }
    this.reconciling = true;
    try {
      while (this.reconcilePending) {
        this.reconcilePending = false;
        await this.runReconcile();
      }
    } finally {
      this.reconciling = false;
    }
  }

  private async runReconcile(): Promise<void> {
    const previousIds = new Set(this.relaysById.keys());
    const relays = await EventRelay.getInstance().findMany({ active: true });
    const nextByChannel = groupRelaysByChannel(relays);
    const { toSubscribe, toUnsubscribe } = planChannelSubscriptions(
      this.subscribedChannels,
      nextByChannel.keys(),
    );

    this.relaysById.clear();
    this.relaysByChannel.clear();
    for (const relay of relays) {
      this.relaysById.set(relay._id, relay);
    }
    for (const [channel, channelRelays] of nextByChannel) {
      this.relaysByChannel.set(
        channel,
        channelRelays.map(relay => compileRelay(relay)),
      );
    }

    for (const id of previousIds) {
      if (!this.relaysById.has(id)) {
        await this.evictRelayRooms(id);
      }
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

    ConduitGrpcSdk.Metrics?.set('event_relays_active_total', this.relaysById.size);
    ConduitGrpcSdk.Metrics?.set(
      'event_relays_subscribed_channels_total',
      this.subscribedChannels.size,
    );
  }

  private onBusMessage(channel: string, message: string): void {
    const relays = this.relaysByChannel.get(channel);
    if (!relays?.length) {
      return;
    }

    let payload: unknown;
    try {
      payload = parseBusPayload(message);
    } catch (err) {
      ConduitGrpcSdk.Metrics?.increment('event_relays_failed_total');
      if (
        err instanceof Error &&
        err.message.includes('exceeds') &&
        err.message.includes('bytes')
      ) {
        ConduitGrpcSdk.Metrics?.increment('event_relays_inbound_dropped_total');
      }
      ConduitGrpcSdk.Logger.error(
        `Event relay failed to parse payload for ${channel}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return;
    }

    for (const relay of relays) {
      void this.emitCompiledRelay(relay, payload, channel);
    }
  }

  private async emitCompiledRelay(
    relay: CompiledRelay,
    payload: unknown,
    channel: string,
  ): Promise<void> {
    let room: string;
    let data: unknown;
    let resourceId: string;
    try {
      ({ room, data, resourceId } = relay.buildEmission(payload));
    } catch (err) {
      ConduitGrpcSdk.Metrics?.increment('event_relays_failed_total');
      ConduitGrpcSdk.Logger.warn(
        `Event relay ${relay.relayId} skipped on ${relay.busEvent}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return;
    }

    const userIds = await this.sockets.getLocalRoomUserIds(room);
    if (userIds.length === 0) {
      ConduitGrpcSdk.Metrics?.increment('event_relays_empty_room_total');
      return;
    }

    const allowedUsers: string[] = [];
    for (const userId of userIds) {
      const allowed = await this.rebacCache.can(
        this.grpcSdk,
        userId,
        relay.permission,
        relay.resourceType,
        resourceId,
      );
      if (allowed) {
        allowedUsers.push(userId);
      } else {
        await this.push('leave-room', undefined, [room], [userId]);
        ConduitGrpcSdk.Metrics?.increment('event_relay_subscriptions_denied_total');
      }
    }

    if (allowedUsers.length === 0) {
      return;
    }

    try {
      const emitted = await this.push(relay.socketEvent, data, [room]);
      if (emitted) {
        ConduitGrpcSdk.Metrics?.increment('event_relays_emitted_total');
      } else {
        ConduitGrpcSdk.Metrics?.increment('event_relays_empty_room_total');
      }
    } catch (err) {
      ConduitGrpcSdk.Metrics?.increment('event_relays_failed_total');
      ConduitGrpcSdk.Logger.error(
        `Event relay ${relay.relayId} emit failed on ${channel}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
