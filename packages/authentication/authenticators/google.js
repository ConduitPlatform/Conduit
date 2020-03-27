const {OAuth2Client} = require('google-auth-library');
const isNil = require('lodash/isNil');
const moment = require('moment');
const authHelper = require('../helpers/authHelper');

const client = new OAuth2Client();

async function authenticate(req, res, next) {
  const {id_token, access_token, refresh_token, expires_in} = req.body;
  const database = req.app.conduit.database.getDbAdapter();

  const ticket = await client.verifyIdToken({
    idToken: id_token,
    audience: process.env.googleClientId
  });

  const payload = ticket.getPayload();
  if (!payload.email_verified) {
    return res.status(401).json({error: 'Unauthorized'});
  }

  const userModel = database.getSchema('User');
  const accessTokenModel = database.getSchema('AccessToken');
  const refreshTokenModel = database.getSchema('RefreshToken');

  let user = await userModel.findOne({email: payload.email});

  if (!isNil(user)) {
    if (process.env.googleAccountLinking === 'false') {
      return res.status(401).json({error: 'User with this email already exists'});
    }
    if (isNil(user.google)) {
      user.google = {
        id: payload.sub,
        token: access_token,
        tokenExpires: moment().add(expires_in).format(),
        refreshToken: refresh_token
      };
      if (!user.isVerified) user.isVerified = true;
      user = await userModel.findByIdAndUpdate(user);
    }
  } else {
    user = await userModel.create({
      email: payload.email,
      google: {
        id: payload.sub,
        token: access_token,
        tokenExpires: moment().add(expires_in).format(),
        refreshToken: refresh_token
      },
      isVerified: true
    });
  }

  const accessToken = await accessTokenModel.create({
    userId: user._id,
    token: authHelper.encode({id: user._id}),
    expiresOn: moment().add(1200, 'seconds').format()
  });

  const refreshToken = await refreshTokenModel.create({
    userId: user._id,
    token: authHelper.generate()
  });

  return res.json({userId: user._id.toString(), accessToken: accessToken.token, refreshToken: refreshToken.token});
}

module.exports.authenticate = authenticate;
