const request = require('request-promise');
const authHelper = require('../helpers/authHelper');
const moment = require('moment');
const isNil = require('lodash/isNil');

async function authenticate(req, res, next) {
  const access_token = req.body.access_token;
  const database = req.app.conduit.database.getDbAdapter();

  try {
    const facebookOptions = {
      method: 'GET',
      url: 'https://graph.facebook.com/v5.0/me',
      qs: {
        access_token,
        fields: 'id,email'
      },
      json: true
    };

    const facebookResponse = await request(facebookOptions);

    if (isNil(facebookResponse.email) || isNil(facebookResponse.id)) {
      return res.status(401).json({error: 'Authentication with facebook failed'});
    }

    const userModel = database.getSchema('User');
    const accessTokenModel = database.getSchema('AccessToken');
    const refreshTokenModel = database.getSchema('RefreshToken');

    let user = await userModel.findOne({email: facebookResponse.email});

    if (!isNil(user)) {
      if (process.env.facebookAccountLinking === 'false') {
        return res.status(401).json({error: 'User with this email already exists'});
      }
      if (isNil(user.facebook)) {
        user.facebook = {
          id: facebookResponse.id,
        };
        if (!user.isVerified) user.isVerified = true;
        user = await userModel.findByIdAndUpdate(user);
      }
    } else {
      user = await userModel.create({
        email: facebookResponse.email,
        facebook: {
          id: facebookResponse.id
        },
        isVerified: true
      });
    }

    const accessToken = await accessTokenModel.create({
      userId: user._id,
      token: authHelper.encode({id: user._id}),
      expiresOn: moment().add(Number(process.env.tokenInvalidationPeriod)).format()
    });

    const refreshToken = await refreshTokenModel.create({
      userId: user._id,
      token: authHelper.generate(),
      expiresOn: moment().add(Number(process.env.refreshTokenInvalidationPeriod)).format()
    });

    return res.json({userId: user._id.toString(), accessToken: accessToken.token, refreshToken: refreshToken.token});
  } catch (e) {
    return next(e);
  }
}

module.exports.authenticate = authenticate;
