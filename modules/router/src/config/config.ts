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
    clientSecretEncryptionKey: {
      doc: 'Standard base64 of exactly 32 bytes. Empty is allowed. Set with CLIENT_SECRET_ENCRYPTION_KEY (read at use, not stored) or PATCH /config/router. Changing it makes every stored secret undecryptable. There is no rotation.',
      format: 'String',
      default: '',
      sensitive: true,
    },
    clientSignaturePathPrefix: {
      doc: 'Prepended to the path the router verifies. A proxy that strips /api is fixed by /api.',
      format: 'String',
      default: '',
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
