const mongoose = require('../db/mongoose');
const Schema = mongoose.Schema;

const RefreshToken = new Schema({
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        token: {
            type: String
        },
        expiresOn: Date,
        securityDetails: {
            macAddress: String,
            userAgent: String
        }
    },
    {
        timestamps: true
    });

module.exports = mongoose.model('RefreshToken', RefreshToken);


