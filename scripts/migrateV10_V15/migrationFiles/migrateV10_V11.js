import db from '../mongoConnection.js';
import _ from 'lodash';


const migrateV11_V15_CustomEndpoints = async () => {
  const documents = db.collection('customendpoints');
  const customEndpoints = await documents.find().toArray();
  for (const customEndpoint of customEndpoints) {
    if (!_.isNil(customEndpoint.queries) &&  _.isNil(customEndpoint.query)) {
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
  if(!_.isNil(schemaDefinitions)){
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
          modelOptions = _.merge(
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
            ? _.merge(declaredSchema.modelOptions, modelOptions)
            : modelOptions;
      }
       const newSchema = { name: schema.name, fields: schema.fields, modelOptions: modelOptions };
       await documents.updateOne({name:schema.name}, {$set: {...newSchema}}, {upsert: true});
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
  const documents = db.collection('files');
  const files = await documents.find({ container: { $exists: false } }).toArray();
  for (const file of files) {
    file.container = file.folder;
    file.folder = null;
    const storageCollection = db.collection('_storagecontainers');
    let exists = await storageCollection.findOne({ name: file.container });
    if (!exists) {
      await storageCollection.insertOne({ name: file.container });
    }
    await documents.updateMany({ _id: file._id }, { $set: { container: file.container, folder: file.folder } });
  }
}

export async function migrateV10_V11() {
  await migrateV11_V15_CustomEndpoints();
  await migrateV10_V11_SchemaDefinitions();
  await migrateV11_V15_ModelOptions();
  await migrateV11_V15_FoldersToContainers();
}

