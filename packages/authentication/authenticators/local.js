const isNil = require('lodash/isNil');
const authHelper = require('../helpers/authHelper');
const moment = require('moment');

async function register(req, res, next) {
  const {email, password} = req.body;
  const database = req.app.conduit.database.getDbAdapter();

    if (process.env.localAuthIsActive === 'false') return res.status(403).json({error: 'Local authentication is disabled'});
    if (isNil(email) || isNil(password)) return res.status(403).json({error: 'Email and password required'});

    const userModel = database.getSchema('User');

    let user = await userModel.findOne({email});
    if (!isNil(user)) return res.status(403).json({error: 'User already exists'});

    const hashedPassword = await authHelper.hashPassword(password);
    user = await userModel.create({
      email,
      hashedPassword
    });

    return res.json({message: 'Registration was successful'});
}

async function authenticate(req, res, next) {
  const {email, password} = req.body;
  const database = req.app.conduit.database.getDbAdapter();

    if (process.env.localAuthIsActive === 'false') return res.status(403).json({error: 'Local authentication is disabled'});
    if (isNil(email) || isNil(password)) return res.status(403).json({error: 'Email and password required'});

    const userModel = database.getSchema('User');
    const accessTokenModel = database.getSchema('AccessToken');
    const refreshTokenModel = database.getSchema('RefreshToken');

    const user = await userModel.findOne({email}, '+hashedPassword');
    if (isNil(user)) return res.status(401).json({error: 'Invalid login credentials'});
    if (!user.active) return res.status(403).json({error: 'Inactive user'});
    // if (!user.isVerified) return res.status(403).json({error: 'You must verify your account to login'});

    const passwordsMatch = await authHelper.checkPassword(password, user.hashedPassword);
    if (!passwordsMatch) return res.status(401).json({error: 'Invalid login credentials'});

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
}


module.exports.authenticate = authenticate;
module.exports.register = register;
