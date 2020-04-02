export default {
  name: 'Admin',
  modelSchema: {
    username: {
      type: String,
      required: true
    },
    password: {
      type: String,
      required: true
    }
  },
  options: {
    timestamps: true
  }
}
