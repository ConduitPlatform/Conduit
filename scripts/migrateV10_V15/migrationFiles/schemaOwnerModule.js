const db = require('../mongoConnection');
const readline = require('readline');

const migrateSchemaOwnerModule = async () => {

  const dictionary = {
    authentication: ['AccessToken', 'RefreshToken', 'Token', 'User'],
    database: ['SchemaDefinitions', 'CustomEndpoints'],
    chat: ['ChatMessage', 'ChatRoom'],
    forms: ['Forms', 'FormReplies'],
    email: ['EmailTemplate'],
    pushNotifications: ['NotificationToken'],
    storage: ['File', '_StorageContainer', '_StorageFolder'],
  };


  const documents = db.collection('_declaredschemas');
  const schemas = await documents.find({}).toArray();
  for (const schema of schemas) {
    const { name } = schema;
    const ownerModule = Object.keys(dictionary).find((key) => dictionary[key].includes(name));
    if (ownerModule) {
      await documents.updateOne({ _id: schema._id }, { $set: { ownerModule } });
    } else {
      let owner;
      console.log('No owner module found for schema: ', name);
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


};

const migrateOwnerModule = async () => {
  await migrateSchemaOwnerModule();
};

module.exports = migrateOwnerModule;