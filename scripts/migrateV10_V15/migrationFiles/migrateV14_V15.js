const db = require('../mongoConnection');
const { isNil } = require('lodash');



const migrateV15_userIdToAccessTokenSchemas = async () => {

  const collection = db.collection('_declaredschemas');
  const accessTokenSchemas = await collection.find({ name: 'AccessToken' , "fields.userId" : { $exists: true }}).toArray();
  for (const accessTokenSchema of accessTokenSchemas) {
    const userId = accessTokenSchema.fields.userId;
    await collection.updateOne({ _id : accessTokenSchema._id }, { $set: {"fields.user" : userId }} );
  }
};

const migrateV15_userIdToRefreshTokenSchemas = async () => {

  const collection = db.collection('_declaredschemas');
  const refreshTokenSchemas = await collection.find({ name: 'RefreshToken', "fields.userId" : { $exists: true } }).toArray();
  for (const refreshTokenSchema of refreshTokenSchemas) {
    const userId = refreshTokenSchema.fields.userId;
    await collection.updateOne({ _id: refreshTokenSchema._id }, { $set: {"fields.user" : userId }});
  }
};

const migrateV15_userIdToTokenSchemas = async () => {
  const collection = db.collection('_declaredschemas');
  const tokenSchemas = await collection.find({ name: 'Token' , "fields.userId" : { $exists: true }}).toArray();
  for (const tokenSchema of tokenSchemas) {
    const userId = tokenSchema.fields.userId;
    await collection.updateOne({ _id: tokenSchema._id }, { $set: {"fields.user" : userId }});
  }
};

const migrateV15_userIdToTwoFactorSchemas = async () => {
  const collection = db.collection('_declaredschemas');
  const twoFactorSecretSchemas = await collection.find({ name: 'TwoFactorSecret' , "fields.userId" : { $exists: true }}).toArray();
  for (const twoFactorSecretSchema of twoFactorSecretSchemas) {
    const userId = twoFactorSecretSchema.fields.userId;
    await collection.updateOne({ _id: twoFactorSecretSchema._id }, { $set: {"fields.user" : userId }});
  }
};

const migrateV15_config = async () => {

  const documents = db.collection('configs');
  const authConfig = await documents.findOne({"moduleConfigs.authentication": {$exists: true}});
  const authConfigData = authConfig.moduleConfigs.authentication;
  if (isNil(authConfigData) || isNil(authConfigData.generateRefreshToken)) {
    return;
  }

  Object.assign(authConfigData, { twoFa: { methods: { sms: false, authenticator: true } } });

  Object.assign(authConfigData, {
    refreshTokens: { enabled: authConfigData.generateRefreshToken },
  });
  Object.assign(authConfigData, {
    refreshTokens: { expiryPeriod: authConfigData.refreshTokenInvalidationPeriod },
  });
  Object.assign(authConfigData, {
    accessTokens: { expiryPeriod: authConfigData.tokenInvalidationPeriod },
  });
  Object.assign(authConfigData, { accessTokens: { jwtSecret: authConfigData.jwtSecret } });

  Object.assign(authConfigData, {
    accessTokens: { setCookie: authConfigData.setCookies?.enabled },
  });
  Object.assign(authConfigData, {
    accessTokens: { cookieOptions: authConfigData.setCookies?.options },
  });
  Object.assign(authConfigData, {
    refreshTokens: { setCookie: authConfigData.setCookies?.enabled },
  });
  Object.assign(authConfigData, {
    refreshTokens: { cookieOptions: authConfigData.setCookies?.options },
  });

  delete authConfigData.twofa;
  delete authConfigData.refreshTokenInvalidationPeriod;
  delete authConfigData.tokenInvalidationPeriod;
  delete authConfigData.jwtSecret;
  delete authConfigData.generateRefreshToken;
  delete authConfigData.setCookies;
  delete authConfigData.rateLimit;

  await documents.findOneAndUpdate({ _id: authConfig._id }, { $set: { "moduleConfigs.authentication": authConfigData } });
};

const migrateV14_V15_System_Schemas = async () => {
  const conduitSystemSchemas = [
    'AccessToken',
    'RefreshToken',
    'Token',
    'TwoFactorSecret',
    'Config',
    'CustomEndpoints',
    'DeclaredSchemas',
    'PendingSchemas',
    'ServiceSchema',
    'User',
    'TwoFactorBackUpCodes',
    'EmailTemplate',
    'ChatRoom',
    'FormReplies',
    'Forms',
    'ChatMessage'
  ];
  const declaredSchemas = db.collection('_declaredschemas');
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
    const customEndpoints = db.collection('customendpoints');
    const affectedSchemaNames = affectedSchemas.map(s => s.name);
    await customEndpoints.deleteMany({ selectedSchema: { $in: affectedSchemaNames } });
  }
};

const migrateV14_V15_CustomEndpoints = async () => {
  const customEndpoints = db.collection('customendpoints');
  const endpoints = await customEndpoints.find({$or: [{ selectedSchema: { $exists: false } }, { selectedSchema: null }],}).toArray();
  for (const endpoint of endpoints) {
    const schemaModel = await db.collection('_declaredschemas').findOne({ name: endpoint.schema });
    if (schemaModel) {
      await customEndpoints.findOneAndUpdate({ _id: endpoint._id }, { $set: { selectedSchema: schemaModel._id.toString() } });
    }
  }
}

const migrateV14_V15 = async () => {
  await migrateV15_userIdToAccessTokenSchemas();
  await migrateV15_userIdToRefreshTokenSchemas();
  await migrateV15_userIdToTokenSchemas();
  await migrateV15_userIdToTwoFactorSchemas();
  await migrateV15_config();
  await migrateV14_V15_System_Schemas();
  await migrateV14_V15_CustomEndpoints();
};

module.exports = migrateV14_V15;

