import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  registeredRoutes: {
    type: MetricType.Gauge,
    config: {
      name: 'client_routes_total',
      help: 'Tracks the total number of registered client routes',
      labelNames: ['transport'],
    },
  },
  securityClients: {
    type: MetricType.Gauge,
    config: {
      name: 'security_clients_total',
      help: 'Tracks the total number of security clients',
      labelNames: ['platform'],
    },
  },
  eventRelaysEmitted: {
    type: MetricType.Counter,
    config: {
      name: 'event_relays_emitted_total',
      help: 'Tracks successfully emitted event-to-socket relays',
    },
  },
  eventRelaysFailed: {
    type: MetricType.Counter,
    config: {
      name: 'event_relays_failed_total',
      help: 'Tracks event-to-socket relay parse, render, or emit failures',
    },
  },
  eventRelaySubscriptionsDenied: {
    type: MetricType.Counter,
    config: {
      name: 'event_relay_subscriptions_denied_total',
      help: 'Tracks denied or unavailable event-relay socket subscriptions',
    },
  },
  eventRelaysActive: {
    type: MetricType.Gauge,
    config: {
      name: 'event_relays_active_total',
      help: 'Active event relays on this router replica',
    },
  },
  eventRelaysSubscribedChannels: {
    type: MetricType.Gauge,
    config: {
      name: 'event_relays_subscribed_channels_total',
      help: 'Bus channels this router replica subscribes to for event relays',
    },
  },
  eventRelaysEmptyRoom: {
    type: MetricType.Counter,
    config: {
      name: 'event_relays_empty_room_total',
      help: 'Skipped emits because no local sockets were in the relay room',
    },
  },
  eventRelaysInboundDropped: {
    type: MetricType.Counter,
    config: {
      name: 'event_relays_inbound_dropped_total',
      help: 'Inbound bus payloads dropped for exceeding the size cap',
    },
  },
  eventRelaysEmitDropped: {
    type: MetricType.Counter,
    config: {
      name: 'event_relays_emit_dropped_total',
      help: 'Socket emits dropped or disconnected due to backpressure',
    },
  },
};
