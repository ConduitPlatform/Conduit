import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  authzRequests: {
    type: MetricType.Counter,
    config: {
      name: 'authorization_requests_total',
      help: 'Tracks the total number of authorization requests',
    },
  },
  totalRules: {
    type: MetricType.Counter,
    config: {
      name: 'authorization_rules_total',
      help: 'Tracks the total number of stored rules',
    },
  },
  totalRoles: {
    type: MetricType.Counter,
    config: {
      name: 'authorization_roles_total',
      help: 'Tracks the total number of stored roles',
    },
  },
  authzDenials: {
    type: MetricType.Gauge,
    config: {
      name: 'authorization_denials',
      help: 'Tracks the total number of denials in authz requests',
    },
  },
  authzCanDuration: {
    type: MetricType.Histogram,
    config: {
      name: 'authorization_can_duration_ms',
      help: 'Wall time for PermissionsController.can() including cache and DB',
      buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    },
  },
  authzAccessListDuration: {
    type: MetricType.Histogram,
    config: {
      name: 'authorization_access_list_duration_ms',
      help: 'Wall time for createAccessList (view/SQL definition)',
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 15000, 60000],
    },
  },
  authzRuleCacheHit: {
    type: MetricType.Counter,
    config: {
      name: 'authorization_rule_cache_hit_total',
      help: 'can() decisions served from rule cache',
    },
  },
  authzRuleCacheMiss: {
    type: MetricType.Counter,
    config: {
      name: 'authorization_rule_cache_miss_total',
      help: 'can() decisions computed after cache miss',
    },
  },
};
