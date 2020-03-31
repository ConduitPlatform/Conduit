module.exports = {
  name: 'Template',
  modelSchema: {
    name: {
      type: String,
      unique: true,
      required: true
    },
    subject: {
      type: String
    },
    body: {
      type: String,
      required: true
    },
    variables: {
      type: [String]
    }
  },
  modelOptions: {
    timestamps: true
  }
};
