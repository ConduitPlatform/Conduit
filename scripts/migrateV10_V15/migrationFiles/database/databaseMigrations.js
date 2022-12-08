const db = require('../../mongoConnection');
const { isNil, merge } = require('lodash');


const migrateV11_V15 = async () => {
  const documents = db.collection('declaredschemas');
  const schemas = await documents.find({ 'modelOptions.conduit': { $exists: false } }).toArray();
  for (const schema of schemas) {
    let newModelOptions = { conduit: {} };
    try {
      newModelOptions = { ...newModelOptions, ...JSON.parse((schema.modelOptions)) };
    } catch {
      newModelOptions = { ...newModelOptions, ...schema.modelOptions };
    }
    await documents.updateMany(schema._id, { $set: { modelOptions: newModelOptions } }).catch((err) => {
      console.log(err);
    });
  }
};

const migrateV12_V15_cmsOwners = async () => {
  const documents = db.collection('declaredschemas');
  const schemas = await documents.find({ ownerModule: 'cms' }).toArray();
  if (schemas.filter((schema) => schema.name !== 'schemadefinitions').length === 0)
    return;
  if (schemas.length > 0) {
    await documents.updateMany({ ownerModule: 'cms' }, { $set: { ownerModule: 'database' } });
  }

  const CustomEndpointSchema = db.collection('customendpoints');
  const customEndpoints = await CustomEndpointSchema.find().toArray();
  for (const customEndpoint of customEndpoints) {
    if (!isNil(customEndpoint.queries) && isNil(customEndpoint.query)) {
      customEndpoint.query = { AND: customEndpoint.queries };
      await CustomEndpointSchema.findOneAndUpdate(customEndpoint._id, customEndpoint);
    }
  }
};

const migrateV12_V15_customEndpoints = async () => {
  const documents = db.collection('declaredschemas');
  const declaredSchemas = await documents.find({ 'modelOptions.conduit': { $exists: false } }).toArray();
  for (const declaredSchema of declaredSchemas) {
    let newModelOptions = { conduit: {} };
    try {
      newModelOptions = { ...newModelOptions, ...JSON.parse((declaredSchema.modelOptions)) };
    } catch {
      newModelOptions = { ...newModelOptions, ...declaredSchema.modelOptions };
    }
    await documents.findOneAndUpdate(declaredSchema._id, { modelOptions: newModelOptions }).catch((err) => {
      console.log(err);
    });
  }
};

const migrateV12_V15_modelOptions = async () => {
  const documents = db.collection('declaredschemas');
  const cmsSchemas = await documents.find({
    $or: [
      { 'modelOptions.conduit.cms.crudOperations': true },
      { 'modelOptions.conduit.cms.crudOperations': false },
    ],
  }).toArray();
  for (const schema of cmsSchemas) {
    const { crudOperations, authentication, enabled } = schema.modelOptions.conduit.cms;
    const cms = {
      enabled: enabled,
      crudOperations: {
        create: {
          enabled: crudOperations,
          authenticated: authentication,
        },
        read: {
          enabled: crudOperations,
          authenticated: authentication,
        },
        update: {
          enabled: crudOperations,
          authenticated: authentication,
        },
        delete: {
          enabled: crudOperations,
          authenticated: authentication,
        },
      },
    };
    const id = schema._id.toString();
    await documents.updateMany({ id }, {
      $set: {
        modelOptions: {
          conduit: { cms },
        },
      },
    });
  }
};

const migrateV12_V15_schemaDefinitions = async () => {
  const documents = db.collection('declaredschemas');
  const schemas = await documents.find().toArray();
  if (schemas.filter((schema) => schema.name === 'schemadefinitions').length === 0)
    return;

  const SchemaDefinitions = db.collection('schemadefinitions');
  const schemaDefinitions = await SchemaDefinitions.find().toArray();

  // Migrate SchemaDefinitions to DeclaredSchemas
  if (!isNil(schemaDefinitions)) {
    for (const schema of schemaDefinitions) {
      const declaredSchema = await db.collection('declaredschemas')
        .findOne({ name: schema.name });
      let modelOptions = {
        conduit: {
          cms: {
            authentication: schema.authentication,
            crudOperations: schema.crudOperations,
            enabled: schema.enabled,
          },
        },
      };
      try {
        modelOptions = merge(
          JSON.parse(schema.modelOptions),
          modelOptions,
        );
      } catch {
      }
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
      const newSchema = (schema.name, schema.fields, modelOptions);
      // create new schema
      await documents.insertOne(newSchema);
    }

    // Delete SchemaDefinitions
    // await adapter.deleteSchema('SchemaDefinitions', true, 'database');
    await SchemaDefinitions.drop();
  }
};

const migrateV14_V15 = async () => {
  const documents = db.collection('declaredschemas');
  await documents.updateMany({ name: 'Client' }, { $set: { ownerModule: 'router' } });
};

const migrateV15 = async () => {
  const collection = db.collection('declaredschemas');
  const declaredSchemas = await collection.find({ $and: [
      { name: { $in: adapter.systemSchemas } },
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
const migrate = async () => {
  await migrateV11_V15();
  await migrateV12_V15_cmsOwners();
  await migrateV12_V15_customEndpoints();
  await migrateV12_V15_modelOptions();
  await migrateV12_V15_schemaDefinitions();
  await migrateV14_V15();
  await migrateV15();
};

migrate().then(r => console.log(r)).catch(e => console.log(e));