let facebook = require('./handlers/authenticators/facebook');
let google = require('./handlers/authenticators/google');
let local = require('./handlers/authenticators/local');
const admin = require('./handlers/admin/admin');
const {isNil} = require('lodash');
const authHelper = require('./helpers/authHelper');
const registerEmailTemplates = require('./templates/registerEmailTemplates');
let refreshToken = require('./models/RefreshToken');
let accessToken = require('./models/AccessToken');
let userModel = require('./models/User');
const tokenModel = require('./models/Token');

let initialized = false;
let database;

// this is for testing purposes
const configuration = {
  local: {
    identifier: 'email',
    active: true
  },
  generateRefreshToken: false,
  rateLimit: 3,
  tokenInvalidationPeriod: 86400000,
  refreshTokenInvalidationPeriod: 86400000 * 7,
  jwtSecret: ''
};

/**
 * @param app
 * @param config The configuration for the plugin
 * {
 *     local: {
 *         identifier: string - default: email,
 *         active: boolean - default: true
 *     },
 *     @optional facebook:{
 *         clientId: string,
 *         clientSecret: string
 *         oAuthRedirectUrl: string
 *     },
 *     @optional google:{
 *         clientId: string,
 *         clientSecret: string
 *         oAuthRedirectUrl: string
 *     }
 *     generateRefreshToken: boolean - default: false,
 *     rateLimit: number - default: 3 (per minute)
 *     tokenInvalidationPeriod: number | null - default 1 day (milliseconds)
 *     refreshTokenInvalidationPeriod: number | null - default 1 week (milliseconds)
 *
 * }
 *
 *
 */
async function authentication(app, config) {

  if (config && !Object.prototype.toString.call(config)) {
    throw new Error("Malformed config provided")
  }

  if (!app) {
    throw new Error("No app provided")
  }
  database = app.conduit.database.getDbAdapter();
  registerSchemas();
  await registerEmailTemplates(app.conduit.email);

  if (config.local) {
    app.post('/authentication/local', (req, res, next) => local.authenticate(req, res, next).catch(next));
    app.post('/authentication/local/new', (req, res, next) => local.register(req, res, next).catch(next));
    app.post('/authentication/forgot-password', (req, res, next) => local.forgotPassword(req, res, next).catch(next));
    app.post('/authentication/reset-password', (req, res, next) => local.resetPassword(req, res, next).catch(next));
    app.get('/hook/verify-email/:verificationToken', (req, res, next) => local.verifyEmail(req, res, next).catch(next));
    app.post('/authentication/renew', (req, res, next) => local.renewAuth(req, res, next).catch(next));
    app.post('/authentication/logout', middleware, (req, res, next) => local.logOut(req, res, next).catch(next));
    initialized = true;
  }

  if (config.facebook.active) {
    app.post('/authentication/facebook', (req, res, next) => facebook.authenticate(req, res, next).catch(next));
    initialized = true;
  }

  if (config.google.active) {
    app.post('/authentication/google', (req, res, next) => google.authenticate(req, res, next).catch(next));
    initialized = true;
  }

  app.conduit.admin.registerRoute('GET', '/users/:skip&:limit',
    (req, res, next) => admin.getUsersPaginated(req, res, next).catch(next));

  app.conduit.admin.registerRoute('PUT', '/config/auth',
    (req, res, next) => admin.editAuthConfig(req, res, next).catch(next));
}

function registerSchemas() {
  database.createSchemaFromAdapter(userModel);
  database.createSchemaFromAdapter(refreshToken);
  database.createSchemaFromAdapter(accessToken);
  database.createSchemaFromAdapter(tokenModel);
}

function middleware(req, res, next) {
  if (!initialized) {
    throw new Error("Authentication module not initialized");
  }
  const header = req.headers['Authorization'] || req.headers['authorization'];
  if (isNil(header)) {
    return res.status(401).json({error: 'Unauthorized'});
  }
  const args = header.split(' ');

  const prefix = args[0];
  if (prefix !== 'Bearer') {
    return res.status(401).json({error: 'The auth header must begin with Bearer'});
  }

  const token = args[1];
  if (isNil(token)) {
    return res.status(401).json({error: 'No token provided'});
  }

  database.getSchema('AccessToken')
    .findOne({token, clientId: req.headers.clientid})
    .then(accessTokenDoc => {
      if (isNil(accessTokenDoc)) {
        return res.status(401).json({error: 'Invalid token'});
      }

      const decoded = authHelper.verify(token, {jwtSecret: req.app.conduit.config.get('authentication.jwtSecret')});
      if (isNil(decoded)) return res.status(401).json({error: 'Invalid token'});

      const userId = decoded.id;

      database.getSchema('User')
        .findOne({_id: userId})
        .then(async user => {
          if (isNil(user)) {
            return res.status(404).json({error: 'User not found'});
          }
          req.user = user;
          next();
        })
    })
    .catch(next);
}

module.exports.initialize = authentication;
module.exports.authenticate = middleware;
