const {ConduitSchema, TYPE} = require("@conduit/sdk");

module.exports = new ConduitSchema('Token',
    {
      type: {
        type: TYPE.String,
      },
      userId: {
        type: TYPE.Relation,
        model: 'User'
      },
      token: {
        type: TYPE.String
      },
      data: {
        type: TYPE.JSON
      }
    },
    {
      timestamps: true
    });
