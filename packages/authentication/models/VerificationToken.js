module.exports = {
  name: 'VerificationToken',
  modelSchema: {
    userId: {
      type: 'Relation',
      model: 'User'
    },
    token: {
      type: String
    }
  },
  modelOptions: {
    timestamps: true
  }
};
