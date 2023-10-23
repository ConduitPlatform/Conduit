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
    proxy: {
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
