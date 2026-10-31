/** Default magic-link lifetime: 3 minutes. A few minutes (about 2 to 5) is the intended lifetime. */
export const MAGIC_LINK_TTL_MS = 3 * 60 * 1000;

export default {
  magic_link: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    redirect_uri: {
      format: 'String',
      default: '',
      optional: true,
    },
    link_uri: {
      doc: 'When specified, this setting overrides the default magic link URI, allowing you to customize the destination where the magic token is sent. Used for manual consumption and token exchange.',
      format: 'String',
      default: '',
      optional: true,
    },
    expiry_period: {
      doc: 'How long a magic link token stays valid, in milliseconds. The default is 3 minutes. A few minutes (about 2 to 5) is the intended lifetime.',
      format: 'Number',
      default: MAGIC_LINK_TTL_MS,
    },
  },
};
