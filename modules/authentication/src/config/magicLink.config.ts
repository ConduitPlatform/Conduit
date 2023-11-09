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
  },
};
