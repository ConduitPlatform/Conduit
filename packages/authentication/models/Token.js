module.exports = {
  name: 'Token',
  modelSchema: {
    type: {
      type: String,
    },
    token: {
      type: String
    },
    data: {
      type: 'JSON'
    }
  },
  modelOptions: {
    timestamps: true
  }
};
