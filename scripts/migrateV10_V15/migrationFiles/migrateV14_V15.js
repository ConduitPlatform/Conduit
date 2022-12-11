const db = require('../mongoConnection');
const { isNil } = require('lodash');


const migrateV15_userIdToAccessTokenSchemas = async () => {
  const collection = db.collection('cnd_accesstokens');
  const accessTokenSchemas = await collection.find({ 'userId': { $exists: true } }).toArray();
  for (const accessTokenSchema of accessTokenSchemas) {
    const userId = accessTokenSchema.userId;
    await collection.updateOne({ _id: accessTokenSchema._id }, { $set: { 'user': userId } });
  }
};

const migrateV15_userIdToRefreshTokenSchemas = async () => {
  const collection = db.collection('cnd_refreshtokens');
  const refreshTokenSchemas = await collection.find({ 'userId': { $exists: true } }).toArray();
  for (const refreshTokenSchema of refreshTokenSchemas) {
    const userId = refreshTokenSchema.userId;
    await collection.updateOne({ _id: refreshTokenSchema._id }, { $set: { 'user': userId } });
  }
};

const migrateV15_userIdToTokenSchemas = async () => {
  const collection = db.collection('cnd_tokens');
  const tokenSchemas = await collection.find({ 'userId': { $exists: true } }).toArray();
  for (const tokenSchema of tokenSchemas) {
    const userId = tokenSchema.userId;
    await collection.updateOne({ _id: tokenSchema._id }, { $set: { 'user': userId } });
  }
};

const migrateV15_userIdToTwoFactorSchemas = async () => {
  const collection = db.collection('cnd_twofactorsecrets');
  const twoFactorSecretSchemas = await collection.find({ 'userId': { $exists: true } }).toArray();
  for (const twoFactorSecretSchema of twoFactorSecretSchemas) {
    const userId = twoFactorSecretSchema.userId;
    await collection.updateOne({ _id: twoFactorSecretSchema._id }, { $set: { 'user': userId } });
  }
};

const migrateV15_config = async () => {

  const documents = db.collection('configs');
  const authConfig = await documents.findOne({ 'moduleConfigs.authentication': { $exists: true } });
  const authConfigData = authConfig.moduleConfigs.authentication;
  if (isNil(authConfigData) || isNil(authConfigData.generateRefreshToken)) {
    return;
  }

  Object.assign(authConfigData, { twoFa: { methods: { sms: false, authenticator: true } } });

  Object.assign(authConfigData, {
    refreshTokens: {
      enabled: authConfigData.generateRefreshToken,
      expiryPeriod: authConfigData.refreshTokenInvalidationPeriod,
      setCookie: authConfigData.setCookies?.enabled,
      cookieOptions: authConfigData.setCookies?.options,
    },
    }
  );

  Object.assign(authConfigData, {
    accessTokens: {
      expiryPeriod: authConfigData.tokenInvalidationPeriod,
      jwtSecret: authConfigData.jwtSecret,
      setCookie: authConfigData.setCookies?.enabled,
      cookieOptions: authConfigData.setCookies?.options,
    }
  }
  );


  delete authConfigData.twofa;
  delete authConfigData.refreshTokenInvalidationPeriod;
  delete authConfigData.tokenInvalidationPeriod;
  delete authConfigData.jwtSecret;
  delete authConfigData.generateRefreshToken;
  delete authConfigData.setCookies;
  delete authConfigData.rateLimit;

  await documents.findOneAndUpdate({ _id: authConfig._id }, { $set: { 'moduleConfigs.authentication': authConfigData } });

};

const migrateV14_V15_CustomEndpoints = async () => {
  const customEndpoints = db.collection('cnd_customendpoints');
  const customEndpointsData = await customEndpoints.find({ $or: [{ selectedSchema: { $exists: false } }, { selectedSchema: null }] }).toArray();

  for (const customEndpoint of customEndpointsData) {
    const schemaModel = await db.collection('cnd_declaredschemas');
    const selectedSchema = await schemaModel.findOne({ name: customEndpoint.schemaName });
    if (!selectedSchema) {
      continue;
    }
    await customEndpoints.updateOne({ _id: customEndpoint._id }, { $set: { selectedSchema: selectedSchema._id.toString() } });
  }
};

const migrateV14_V15_System_Schemas = async () => {
  const conduitSystemSchemas = [
    'AccessToken',
    'RefreshToken',
    'Token',
    'User',
    'Service',
    'SchemaDefinitions',
    'CustomEndpoints',
    'ChatMessage',
    'ChatRoom',
    'Forms',
    'FormReplies',
    'EmailTemplate',
    'NotificationToken',
    'File',
    '_StorageContainer',
    '_StorageFolder',
    'Config',
    'Admin',
    'Client',
    'TwoFactorBackUpCodes',
    'TwoFactorSecret',
    'AdminTwoFactorSecret',
    'Team',
  ];
  const declaredSchemas = db.collection('cnd_declaredschemas');
  const affectedSchemas = await declaredSchemas.find({
    $and: [
      { name: { $in: conduitSystemSchemas } },
      { 'modelOptions.conduit.cms': { $exists: true } },
    ],
  }).toArray();
  if (affectedSchemas.length > 0) {
    for (const schema of affectedSchemas) {
      const conduit = schema.modelOptions.conduit;
      delete conduit.cms;
      await declaredSchemas.findOneAndUpdate({ _id: schema._id }, {
        modelOptions: {
          conduit,
        },
      });
    }
    const customEndpoints = db.collection('cnd_customendpoints');
    const affectedSchemaNames = affectedSchemas.map(s => s.name);
    await customEndpoints.deleteMany({ selectedSchema: { $in: affectedSchemaNames } });
  }
};


const migrateV14_V15 = async () => {
  await migrateV15_userIdToAccessTokenSchemas();
  await migrateV15_userIdToRefreshTokenSchemas();
  await migrateV15_userIdToTokenSchemas();
  await migrateV15_userIdToTwoFactorSchemas();
  await migrateV15_config();
  await migrateV14_V15_CustomEndpoints();
  await migrateV14_V15_System_Schemas();
};

module.exports = migrateV14_V15;

