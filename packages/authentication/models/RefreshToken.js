module.exports = {
    name: 'RefreshToken',
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
        },
        securityDetails: {
            macAddress: String,
            userAgent: String
        }
    },
    modelOptions: {
        timestamps: true
    }
};
