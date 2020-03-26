const {OAuth2Client} = require('google-auth-library');
const isNil = require('lodash/isNil');
const moment = require('moment');
const authHelper = require('../helpers/authHelper');

async function authenticate(req, res, next) {
  const {id_token, access_token, refresh_token, expires_in} = req.body;
  const database = req.app.conduit.database.getDbAdapter();

  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({
    idToken: id_token,
    audience: process.env.googleClientId
  }).catch(() => res.status(401).json({error: 'Unauthorized'}));
  const payload = ticket.getPayload();

  const userModel = database.getSchema('User');
  const accessTokenModel = database.getSchema('AccessToken');
  const refreshTokenModel = database.getSchema('RefreshToken');

  let user = await userModel.findOne({'google.id': payload.sub});
  if (isNil(user)) {
    user = await userModel.create({
      email: payload.email,
      google: {
        id: payload.sub,
        token: access_token,
        tokenExpires: moment().add(expires_in).format(),
        refreshToken: refresh_token
      },
      isVerified: payload.email_verified
    }).catch(err=> res.status(500).json({error: err}));
  }

  await accessTokenModel.deleteOne({userId: user._id});
  const accessToken = await accessTokenModel.create({
    userId: user._id,
    token: authHelper.encode({id: user._id}),
    expiresOn: moment().add(1200, 'seconds').format()
  }).catch(err=> res.status(500).json({error: err}));


  let refreshToken = await refreshTokenModel.findOne({userId: user._id});
  if (isNil(refreshToken)) {
    refreshToken = await refreshTokenModel.create({
      userId: user._id,
      token: authHelper.generate()
    }).catch(err=> res.status(500).json({error: err}));
  }

  return res.json({userId: user._id.toString(), accessToken: accessToken.token, refreshToken: refreshToken.token});
}

module.exports.authenticate = authenticate;
