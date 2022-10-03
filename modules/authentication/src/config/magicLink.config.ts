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
  },
};
