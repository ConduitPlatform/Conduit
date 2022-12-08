const db = require('../mongoConnection');
const { isNil } = require('lodash');

const migrateV12_V15 = async () => {
  const documents = db.collection('configs');
  const authConfig = await documents.findOne({ name: 'authentication' });
  if (authConfig.local['verificationRequired']) {
    authConfig.local.verification = {
      required: authConfig.local['verificationRequired'],
      send_email: authConfig.local['sendVerificationEmail'],
      redirect_uri: authConfig.local['verification_redirect_uri'],
    };
    delete authConfig.local['verificationRequired'];
    delete authConfig.local['sendVerificationEmail'];
    delete authConfig.local['verification_redirect_uri'];
    await documents.findOneAndUpdate(authConfig._id, authConfig);
  }
};

const migrateV15_userIdToAccessTokenSchemas = async () => {

  const accessTokenSchemas = db.collection('accesstokens');
  const accessTokenSchemasData = await accessTokenSchemas.find({ userId: { $exists: true } }).toArray();
  for (const accessTokenSchema of accessTokenSchemasData) {
    accessTokenSchema.user = accessTokenSchema.userId;
    await accessTokenSchemas.findOneAndUpdate( accessTokenSchema._id, accessTokenSchema);
  }
};

const migrateV15_userIdToRefreshTokenSchemas = async () => {


  const refreshTokenSchemas = db.collection('refreshtokens');
  const refreshTokenSchemasData = await refreshTokenSchemas.find({ userId: { $exists: true } }).toArray();
  for (const refreshTokenSchema of refreshTokenSchemasData) {
    refreshTokenSchema.user = refreshTokenSchema.userId;
    await refreshTokenSchemas.findOneAndUpdate( refreshTokenSchema._id, refreshTokenSchema);
  }
};

const migrateV15_userIdToTokenSchemas = async () => {

  const tokenSchemas = db.collection('tokens');
  const tokenSchemasData = await tokenSchemas.find({ userId: { $exists: true } }).toArray();
  for (const tokenSchema of tokenSchemasData) {
    tokenSchema.user = tokenSchema.userId;
    await tokenSchemas.findOneAndUpdate( tokenSchema._id, tokenSchema);
  }
};

const migrateV15_userIdToTwoFactorSchemas = async () => {

  const twoFactorSecretSchemas = db.collection('twofactorsecrets');
  const twoFactorSecretSchemasData = await twoFactorSecretSchemas.find({ userId: { $exists: true } }).toArray();

  for (const twoFactorSecretSchema of twoFactorSecretSchemasData) {
    twoFactorSecretSchema.user = twoFactorSecretSchema.userId;
    await twoFactorSecretSchemas.findOneAndUpdate(twoFactorSecretSchema._id, twoFactorSecretSchema);
  }

};

const migrateV15_config = async () => {

    const documents = db.collection('configs');
    const authConfig = await documents.findOne({ key: 'authentication' });
    if (isNil(authConfig) || isNil(authConfig.generateRefreshToken)) {
      return;
    }

    Object.assign(authConfig, { twoFa: { methods: { sms: false, authenticator: true } } });

    Object.assign(authConfig, {
      refreshTokens: { enabled: authConfig.generateRefreshToken },
    });
    Object.assign(authConfig, {
      refreshTokens: { expiryPeriod: authConfig.refreshTokenInvalidationPeriod },
    });
    Object.assign(authConfig, {
      accessTokens: { expiryPeriod: authConfig.tokenInvalidationPeriod },
    });
    Object.assign(authConfig, { accessTokens: { jwtSecret: authConfig.jwtSecret } });
    Object.assign(authConfig, {
      accessTokens: { setCookie: authConfig.setCookies.enabled },
    });
    Object.assign(authConfig, {
      accessTokens: { cookieOptions: authConfig.setCookies.options },
    });
    Object.assign(authConfig, {
      refreshTokens: { setCookie: authConfig.setCookies.enabled },
    });
    Object.assign(authConfig, {
      refreshTokens: { cookieOptions: authConfig.setCookies.options },
    });

    delete authConfig.twofa;
    delete authConfig.refreshTokenInvalidationPeriod;
    delete authConfig.tokenInvalidationPeriod;
    delete authConfig.jwtSecret;
    delete authConfig.generateRefreshToken;
    delete authConfig.setCookies;
    delete authConfig.rateLimit;

    return authConfig;
}


const migrate = async () => {
  await migrateV12_V15();
  await migrateV15_userIdToAccessTokenSchemas();
  await migrateV15_userIdToRefreshTokenSchemas();
  await migrateV15_userIdToTokenSchemas();
  await migrateV15_userIdToTwoFactorSchemas();
  await migrateV15_config();
};

migrate().catch((err) => { console.log(err); });

