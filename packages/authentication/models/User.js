module.exports = {
    name: 'User',
    modelSchema: {
        email: {
            type: String,
            unique: true,
            required: true
        },
        hashedPassword: {
            type: String,
            select: false
        },
        google: {
            token: {
                type: String
            },
            tokenExpires: {
                type: String
            },
            refreshToken: {
                type: String
            },
            refreshTokenExpires: {
                type: String
            }
        },
        facebook: {
            token: {
                type: String
            },
            tokenExpires: {
                type: String
            },
            refreshToken: {
                type: String
            },
            refreshTokenExpires: {
                type: String
            }
        },
        active: {
            type: Boolean,
            default: true
        },
        isVerified: {type: Boolean, default: false},
    },
    modelOptions: {
        timestamps: true
    }
};

