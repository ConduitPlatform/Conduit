module.exports = {
    name: 'AccessToken',
    schema: {
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
    options: {
        timestamps: true
    }
};
