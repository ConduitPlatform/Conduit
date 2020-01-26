module.exports = {
    name: 'RefreshToken',
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
        },
        securityDetails: {
            macAddress: String,
            userAgent: String
        }
    },
    options: {
        timestamps: true
    }
};
