const db = require('../mongoConnection');
const migrateSchemaOwnerModule = async () => {

    const dictionary = {
      AccessToken: 'authentication',
      RefreshToken: 'authentication',
      Token: 'authentication',
      User: 'authentication',
      Service: 'authentication',
      SchemaDefinitions: 'database',
      CustomEndpoints: 'database',
      ChatMessage: 'chat',
      ChatRoom: 'chat',
      Forms: 'forms',
      FormReplies: 'forms',
      EmailTemplate: 'email',
      NotificationToken: 'pushNotifications',
      File: 'storage',
      _StorageContainer: 'storage',
      _StorageFolder: 'storage',
      Config: 'core',
      Admin: 'core',
      Client: 'router',
      TwoFactorBackUpCodes: 'authentication',
      TwoFactorSecret: 'authentication',
      Team: 'authentication',
      AdminTwoFactorSecret: 'core',
      _PendingSchemas: 'database',
    };
   const noOwnerSchemas = [];

    const documents = db.collection('_declaredschemas');
    const schemas = await documents.find({}).toArray();
    for (const schema of schemas) {
      if (dictionary[schema.name]) {
        await documents.updateOne({ _id: schema._id }, { $set: { ownerModule: dictionary[schema.name] } });
      } else if (schema.modelOptions && schema.modelOptions.conduit && schema.modelOptions.conduit.cms) {
        await documents.updateOne({ _id: schema._id }, { $set: { ownerModule: 'database' } });
      } else {
        noOwnerSchemas.push(schema.name);
      }
    }
    if(noOwnerSchemas.length > 0) {
      if(noOwnerSchemas.length > 1) {
        console.log('The following schemas have no owner module, please provide one: ', noOwnerSchemas);
      }
      else {
        console.log(`The following schema does not have an owner module, please provide one: ${noOwnerSchemas[0]}`);
      }
    }
  }
;

const migrateOwnerModule = async () => {
  await migrateSchemaOwnerModule();
};

module.exports = migrateOwnerModule;