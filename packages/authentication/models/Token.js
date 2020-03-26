module.exports = {
    name: 'AccessToken',
    modelSchema: {
        userId: {
            type: 'Relation',
            model: 'User'
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
