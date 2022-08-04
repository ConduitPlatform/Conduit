import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  loginRequests: {
    type: MetricType.Counter,
    config: {
      name: 'login_requests_total',
      help: 'Tracks the total number of login requests',
    },
  },
  loggedInUsers: {
    type: MetricType.Gauge,
    config: {
      name: 'logged_in_users_total',
      help: 'Tracks the total number of logged in users',
    },
  },
};
