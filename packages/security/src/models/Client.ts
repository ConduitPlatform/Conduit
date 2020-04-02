export const ClientModel = {
  name: 'Client',
  modelSchema: {
    clientId: {
      type: String,
      unique: true,
      required: true
    },
    clientSecret: {
      type: String,
      required: true
    }
  },
  modelOptions: {
    timestamps: true
  }
};
