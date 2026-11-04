export default {
  hostUrl: {
    // set initial value with __DEFAULT_HOST_URL, defaults to http://localhost:(CLIENT_HTTP_PORT ?? 3000)
    format: 'String',
    default: '',
  },
  captcha: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    provider: {
      format: 'String',
      default: 'recaptcha',
      enum: ['recaptcha', 'hcaptcha', 'turnstile'],
    },
    secretKey: {
      format: 'String',
      default: '',
    },
  },
  cors: {
    enabled: {
      format: 'Boolean',
      default: true,
    },
    origin: {
      format: 'String',
      default: '*',
    },
    methods: {
      format: 'String',
      default: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    },
    allowedHeaders: {
      format: 'String',
      default: 'Content-Type,Authorization,Cache-Control',
    },
    exposedHeaders: {
      format: 'String',
      default: 'Content-Type,Authorization,Cache-Control',
    },
    credentials: {
      format: 'Boolean',
      default: true,
    },
    maxAge: {
      format: 'Number',
      default: 86400,
    },
  },
  transports: {
    rest: {
      format: 'Boolean',
      default: true,
    },
    graphql: {
      format: 'Boolean',
      default: true,
    },
    sockets: {
      format: 'Boolean',
      default: true,
    },
  },
  security: {
    clientValidation: {
      format: 'Boolean',
      default: false,
    },
  },
  sockets: {
    maxHttpBufferSize: {
      format: 'Number',
      default: 1000000,
      doc: 'Maximum size in bytes of a single message a socket client may send. Applies to new connections.',
    },
    rateLimit: {
      enabled: {
        format: 'Boolean',
        default: true,
        doc: 'Limit how many events each socket may send.',
      },
      burst: {
        format: 'Number',
        default: 100,
        doc: 'Events a socket may send in a burst.',
      },
      eventsPerSecond: {
        format: 'Number',
        default: 30,
        doc: 'Sustained events per second once the burst is spent.',
      },
    },
    disconnectOnTokenExpiry: {
      format: 'Boolean',
      default: true,
      doc: 'Disconnect sockets when their access token expires. Clients must refresh the token and reconnect.',
    },
  },
  rateLimit: {
    maxRequests: {
      format: 'Number',
      default: 50,
      doc: 'Maximum number of allowed user requests per reset interval.',
    },
    resetInterval: {
      format: 'Number',
      default: 1,
      doc: 'Request count reset timeframe. Expressed in seconds.',
    },
  },
};
