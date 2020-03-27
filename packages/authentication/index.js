let facebook = require('./authenticators/facebook');
let google = require('./authenticators/google');
let local = require('./authenticators/local');

const jwt = require('jsonwebtoken');


let refreshToken = require('./models/RefreshToken');
let accessToken = require('./models/Token');
let userModel = require('./models/User');

let initialized = false;
let database;
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
function authentication(app, config) {

    if (config && !Object.prototype.toString.call(config)) {
        throw new Error("Malformed config provided")
    }

    if (!app) {
        throw new Error("No app provided")
    }
    database = app.conduit.database.getDbAdapter();
    registerSchemas();

    if (config.local) {
        app.get('/authentication/local', local.authenticate);
        app.get('/authentication/local/new', local.register);
        initialized = true;
    }

    if (config.facebook) {
        app.get('/authentication/facebook', (req, res, next) => facebook.authenticate(req, res, next).catch(next));
        initialized = true;
    }

    if (config.google) {
        app.get('/authentication/google', google.authenticate);
        initialized = true;
    }

}

function registerSchemas() {
    database.createSchemaFromAdapter(userModel);
    database.createSchemaFromAdapter(refreshToken);
    database.createSchemaFromAdapter(accessToken);
}

function middleware(req, res, next) {
    if (!initialized) {
        throw new Error("Authentication module not initialized");
    }
    const header = req.headers['Authorization'] || req.headers['authorization'];
    if (header === null || header === undefined) {
        return res.status(401).json({error: 'Unauthorized'});
    }
    const args = header.split(' ');

    const prefix = args[0];
    if (prefix !== 'Bearer') {
        return res.status(401).json({error: 'The auth header must begin with Bearer'});
    }

    const token = args[1];
    if (token === null || token === undefined) {
        return res.status(401).json({error: 'No token provided'});
    }

    const decoded = jwt.verify(token, configuration.jwtSecret);
    if (decoded === null || decoded === undefined) return res.status(401).json({error: 'Invalid token'});

    const {id: userId} = decoded;

    database.getSchema('Token')
        .findOne({_id: userId})
        .then(async user => {
            if (user === null || user === undefined) {
                // todo change this to proper error
                throw new HttpError(null, 'User not found', 404);
            }
            req.user = user;
            next();
        })
        .catch(next);
}

module.exports.initialize = authentication;
module.exports.authenticate = middleware;
