const db = require('../mongoConnection');

const migrateSchemaOwnerModule = async () => {
  const schemaNames = [
    'AccessToken',
    'RefreshToken',
    'Token',
    'TwoFactorSecret',
    'Config',
    'User',
  ];

  const documents = db.collection('_declaredSchemas');
  await documents.updateMany({ name: { $in: schemaNames } }, { $set: { ownerModule: 'authentication' } });


}

const migrateOwnerModule = async () => {
  await migrateSchemaOwnerModule();
}

module.exports = migrateOwnerModule;