const db = require('../mongoConnection');
const { isNil } = require('lodash');

const migrateV11_V15_Database = async () => {
  const documents = db.collection('_declaredschemas');
  const schemas = await documents.find({ 'modelOptions.conduit': { $exists: false } }).toArray();
  for (const schema of schemas) {
    let newModelOptions = { conduit: {} };
    try {
      newModelOptions = { ...newModelOptions, ...JSON.parse((schema.modelOptions)) };
    } catch {
      newModelOptions = { ...newModelOptions, ...schema.modelOptions };
    }
    await documents.updateMany({ _id: schema._id }, { $set: { modelOptions: newModelOptions } }).catch((err) => {
      console.log(err);
    });
  }
};

const migrateV11_V15_Storage = async () => {
  const documents = db.collection('files');
  const files = await documents.find({ container: { $exists: false } }).toArray();
  for (const file of files) {
    file.container = file.folder;
    file.folder = null;
    let storageContainer = db.collection('storagecontainers')
    let exists = await storageContainer.findOne({name: file.container});
    if (!exists) {
      await db.collection('storagecontainers').insertOne({ name: file.container });
    }
    await documents.findOneAndUpdate({ _id: file.id }, file);
  }
}

const migrateV11_V15_CustomEndpoints = async () => {
  const documents = db.collection('customendpoints');
  const customEndpoints = await documents.find().toArray();
  for (const customEndpoint of customEndpoints) {
    if (!isNil(customEndpoint.queries) && isNil(customEndpoint.query)) {
      customEndpoint.query = { AND: customEndpoint.queries };
      await documents.updateMany(customEndpoint._id, customEndpoint);
    }
  }
}
const migrateV10_V11 = async () => {
  await migrateV11_V15_Database();
  await migrateV11_V15_Storage();
  await migrateV11_V15_CustomEndpoints();
}

module.exports = migrateV10_V11;