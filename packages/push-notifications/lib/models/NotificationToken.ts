export const NotificationTokenModel = {
  name: 'NotificationToken',
  modelSchema: {
    userId: {
      type: 'Relation',
      model: 'User'
    },
    token: {
      type: String,
      required: true
    },
    platform: {
      type: String
    }
  },
  modelOptions: {
    timestamps: true
  }
};
