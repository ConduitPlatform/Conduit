const db = require('../mongoConnection');
const { isNil } = require('lodash');



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

const migrateV14_V15_Database = async () => {
  const conduitSystemSchemas = ['']
  const collection = db.collection('_declaredschemas');
  const declaredSchemas = await collection.find({ $and: [
      { name: { $in: conduitSystemSchemas} },
      { 'modelOptions.conduit.cms': { $exists: true } },
    ]}).toArray();
  /*
  *   const declaredSchemas = adapter.getSchemaModel('_DeclaredSchema').model;
  const affectedSchemas: IDeclaredSchema[] = await declaredSchemas.findMany({
    $and: [
      { name: { $in: adapter.systemSchemas } },
      { 'modelOptions.conduit.cms': { $exists: true } },
    ],
  });

  if (affectedSchemas.length > 0) {
    for (const schema of affectedSchemas) {
      const conduit = schema.modelOptions.conduit;
      delete conduit!.cms;
      await declaredSchemas.findByIdAndUpdate(schema._id, {
        modelOptions: {
          conduit,
        },
      });
    }
    const customEndpoints = adapter.getSchemaModel('CustomEndpoints').model;
    const affectedSchemaNames = affectedSchemas.map(s => s.name);
    await customEndpoints.deleteMany({ selectedSchema: { $in: affectedSchemaNames } });
  }*/
};

 const migrateV14_V15= async () => {
  await migrateV15_userIdToAccessTokenSchemas();
  await migrateV15_userIdToRefreshTokenSchemas();
  await migrateV15_userIdToTokenSchemas();
  await migrateV15_userIdToTwoFactorSchemas();
  await migrateV15_config();
  await migrateV14_V15_Database();
};

module.exports = migrateV14_V15;

