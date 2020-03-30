module.exports = {
  name: 'Token',
  modelSchema: {
    type: {
      type: 'String',
    },
    userId: {
      type: 'Relation',
      model: 'User'
    },
    token: {
      type: String
    },
  },
  modelOptions: {
    timestamps: true
  }
};
