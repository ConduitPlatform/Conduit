const db = require('../mongoConnection');
const readline = require('readline');

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
  };


const documents = db.collection('_declaredschemas');
const schemas = await documents.find({}).toArray();
  for (const schema of schemas) {
    if (dictionary[schema.name]) {
      await documents.updateOne({ _id: schema._id }, { $set: { ownerModule: dictionary[schema.name] } });
    }
    else if(schema.modelOptions && schema.modelOptions.conduit && schema.modelOptions.conduit.cms){
      await documents.updateOne({ _id: schema._id }, { $set: { ownerModule: 'database' } });
    }
    else {
      let owner;
      console.log('No owner module found for schema: ', schema.name);
      const inputOwnerModule = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      inputOwnerModule.question('Please enter the owner module: ', (userInput) => {
        owner = userInput;
        inputOwnerModule.close();
      });
      await documents.updateOne({ _id: schema._id }, { $set: { ownerModule: owner } });
    }
  }
}
;

const migrateOwnerModule = async () => {
  await migrateSchemaOwnerModule();
};

module.exports = migrateOwnerModule;