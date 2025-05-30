export default {
  local: {
    enabled: {
      doc: 'Defines if this strategy is active or not',
      format: 'Boolean',
      default: true,
    },
    verification: {
      required: {
        doc: 'Defines if email verification is required for login',
        format: 'Boolean',
        default: false,
      },
      send_email: {
        doc: 'Defines if the authenticator should automatically send a verification e-mail to the user',
        format: 'Boolean',
        default: false,
      },
      method: {
        doc: 'Defines if verification should be done via link or code',
        format: 'String',
        default: 'link',
        enum: ['link', 'code'],
      },
      redirect_uri: {
        doc: 'Defines where the user should be redirected after verification',
        format: 'String',
        default: '',
      },
      resend_threshold: {
        doc: 'Defines the threshold in milliseconds for resending verification',
        format: 'Number',
        default: 60000,
      },
    },
    forgot_password_redirect_uri: {
      doc: 'Defines where the user should be redirected once they click the forgot password link',
      format: 'String',
      default: '',
    },
    username_auth_enabled: {
      doc: 'Defines if username authentication strategy is enabled',
      format: 'Boolean',
      default: false,
    },
  },
};
