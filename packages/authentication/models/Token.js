const mongoose = require('../db/mongoose');
const Schema = mongoose.Schema;

const AccessToken = new Schema({
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        token: {
            type: String
        },
        expiresOn: Date
    },
    {
        timestamps: true
    });

module.exports = mongoose.model('AccessToken', AccessToken);


