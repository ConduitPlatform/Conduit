const db = require('../mongoConnection');
const { isNil, merge } = require('lodash');

const migrateV11_V15_CustomEndpoints = async () => {
  const documents = db.collection('customendpoints');
  const customEndpoints = await documents.find().toArray();
  for (const customEndpoint of customEndpoints) {
    if (!isNil(customEndpoint.queries) && isNil(customEndpoint.query)) {
      await documents.updateMany({_id: customEndpoint._id}, {$set: customEndpoint.query = customEndpoint.queries});
    }
  }
}
const migrateV10_V11_SchemaDefinitions = async () => {

  const documents = db.collection('_declaredschemas');

  const schemaDefinitions = await db.collection('schemadefinitions').find().toArray();
  if(schemaDefinitions.length === 0){
    return;
  }
  if(!isNil(schemaDefinitions)){
    for(const schema of schemaDefinitions) {
      const declaredSchema = await documents.findOne({ name: schema.name});
      let modelOptions = {
        conduit: {
          cms: {
            authentication: schema.authentication,
            crudOperations: schema.crudOperations,
            enabled: schema.enabled,
          }
        }
      };
        try {
          modelOptions = merge(
            JSON.parse(schema.modelOptions),
            modelOptions,
          );
        } catch {}
      if ((declaredSchema) && (
        !declaredSchema.modelOptions ||
        !declaredSchema.modelOptions.conduit ||
        !('cms' in declaredSchema.modelOptions.conduit)
      )) {
        // DeclaredSchema exists, missing metadata
        modelOptions =
          declaredSchema.modelOptions // possibly undefined
            ? merge(declaredSchema.modelOptions, modelOptions)
            : modelOptions;
      }
       const newSchema = { name: schema.name, fields: schema.fields, modelOptions: modelOptions };
       await documents.insertOne(newSchema);
    }
    // Delete SchemaDefinitions
    await documents.deleteMany({ name: 'SchemaDefinitions' });

    }
}
const migrateV11_V15_ModelOptions = async () => {
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

const migrateV11_V15_FoldersToContainers = async () => {
  const documents = db.collection('_declaredschemas');
  const schemas = await documents.find({ name: 'File', container: { $exists: false } }).toArray();
  for (const schema of schemas) {
    schema.container = schema.folder;
    schema.folder = null;
    const storage = await documents.findOne({ name: '_StorageContainer' });
    let exists = storage.fields.find((field) => field.name === schema.container);
    if (!exists) {
      await db.collection('_StorageContainer').insertOne({ name: schema.container });
    }
    await documents.findOneAndUpdate({ _id: schema.id }, { $set: { container: schema.container, folder: null } });
  }
}

const migrateV10_V11 = async () => {
  await migrateV11_V15_CustomEndpoints();
  await migrateV10_V11_SchemaDefinitions();
  await migrateV11_V15_ModelOptions();
  await migrateV11_V15_FoldersToContainers();
}

module.exports = migrateV10_V11;