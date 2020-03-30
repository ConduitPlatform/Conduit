module.exports = {
  name: 'PasswordResetToken',
  modelSchema: {
    userId: {
      type: 'Relation',
      model: 'User',
      unique: true
    },
    token: {
      type: String
    }
  },
  modelOptions: {
    timestamps: true
  }
};
