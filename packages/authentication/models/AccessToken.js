module.exports = {
    name: 'AccessToken',
    modelSchema: {
        userId: {
            type: 'Relation',
            model: 'User'
        },
        clientId: {
          type: String,
          required: true
        },
        token: {
            type: String
        },
        expiresOn: {
            type: Date
        }
    },
    modelOptions: {
        timestamps: true
    }
};
