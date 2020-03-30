const isNil = require('lodash/isNil');
const authHelper = require('../helpers/authHelper');
const moment = require('moment');
const emailProvider = require('@conduit/email');
const uuid = require('uuid/v4');

async function register(req, res, next) {
  const {email, password} = req.body;
  const database = req.app.conduit.database.getDbAdapter();

  if (process.env.localAuthIsActive === 'false') return res.status(403).json({error: 'Local authentication is disabled'});
  if (isNil(email) || isNil(password)) return res.status(403).json({error: 'Email and password required'});

  const userModel = database.getSchema('User');
  const verificationTokenModel = database.getSchema('VerificationToken');

  let user = await userModel.findOne({email});
  if (!isNil(user)) return res.status(403).json({error: 'User already exists'});

  const hashedPassword = await authHelper.hashPassword(password);
  user = await userModel.create({
    email,
    hashedPassword
  });

  if (process.env.localSendVerificationEmail === 'true') {
    const verificationTokenDoc = await verificationTokenModel.create({
      userId: user._id,
      token: uuid()
    });
    // this will be completed when we build the email provider module
    const link = `http://localhost:3000/authentication/verify-email/${verificationTokenDoc.token}`;
    await emailProvider.sendMail({
      email: user.email,
      body: link
    });
  }

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

  if (process.env.localVerificationRequired === 'true' && !user.isVerified)
    return res.status(403).json({error: 'You must verify your account to login'});

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

async function forgotPassword(req, res, next) {
  const email = req.body.email;
  if (isNil(email)) res.status(401).json({error: 'Email field required'});

  const database = req.app.conduit.database.getDbAdapter();
  const userModel = database.getSchema('User');
  const passwordResetTokenModel = database.getSchema('PasswordResetToken');

  const user = await userModel.findOne({email});

  if (isNil(user) || (process.env.localVerificationRequired === 'true' && !user.isVerified))
    return res.json({message: 'Ok'});

  const oldToken = await passwordResetTokenModel.findOne({userId: user._id});
  if (!isNil(oldToken)) await oldToken.remove();

  const passwordResetTokenDoc = await passwordResetTokenModel.create({
    userId: user._id,
    token: uuid()
  });

  // this will be completed when we build the email provider module

  // const link = `http://localhost:3000/authentication/reset-password/${passwordResetTokenDoc.token}`;
  // await emailProvider.sendMail({
  //   email: user.email,
  //   body: link
  // });

  return res.json({message: 'Ok'});
}

async function resetPassword(req, res, next) {
  const passwordResetTokenParam = req.body.passwordResetToken;
  const newPassword = req.body.password;
  if (isNil(newPassword) || isNil(passwordResetTokenParam)) {
    return res.status(401).json({error: 'Required fields are missing'});
  }

  const database = req.app.conduit.database.getDbAdapter();
  const userModel = database.getSchema('User');
  const passwordResetTokenModel = database.getSchema('PasswordResetToken');

  const passwordResetTokenDoc = await passwordResetTokenModel.findOne({token: passwordResetTokenParam});
  if (isNil(passwordResetTokenDoc)) return res.status(401).json({error: 'Invalid parameters'});

  const user = await userModel.findOne({_id: passwordResetTokenDoc.userId}, '+hashedPassword');
  if (isNil(user)) return res.status(404).json({error: 'User not found'});

  const passwordsMatch = await authHelper.checkPassword(newPassword, user.hashedPassword);
  if (passwordsMatch) return res.status(401).json({error: "Password can't be the same as the old one"});

  user.hashedPassword = await authHelper.hashPassword(newPassword);
  await user.save();
  await passwordResetTokenDoc.remove();

  return res.json({message: 'Password reset successful'});
}

async function verifyEmail(req, res, next) {
  const verificationTokenParam = req.params.verificationToken;
  if (isNil(verificationTokenParam)) return res.status(401).json({error: 'Invalid parameters'});

  const database = req.app.conduit.database.getDbAdapter();
  const userModel = database.getSchema('User');
  const verificationTokenModel = database.getSchema('VerificationToken');

  const verificationTokenDoc = await verificationTokenModel.findOne({token: verificationTokenParam});
  if (isNil(verificationTokenDoc)) return res.status(401).json({error: 'Invalid parameters'});

  const user = await userModel.findOne({_id: verificationTokenDoc.userId});
  if (isNil(user)) return res.status(404).json({error: 'User not found'});

  user.isVerified = true;
  await user.save();
  await verificationTokenDoc.remove();

  return res.json({message: 'Email verified'});
}

module.exports.authenticate = authenticate;
module.exports.register = register;
module.exports.forgotPassword = forgotPassword;
module.exports.resetPassword = resetPassword;
module.exports.verifyEmail = verifyEmail;
