const {ConduitSchema, TYPE} = require("@conduit/sdk");

module.exports = new ConduitSchema('AccessToken',
    {
        userId: {
            type: TYPE.Relation,
            model: 'User'
        },
        clientId: {
            type: TYPE.String,
            required: true
        },
        token: {
            type: TYPE.String
        },
        expiresOn: {
            type: TYPE.Date
        }
    },
    {
        timestamps: true
    });
