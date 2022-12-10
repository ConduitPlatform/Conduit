const db = require('../mongoConnection');

const migateV12_V13 = async () => {
  const documents = db.collection('_declaredschemas');
  const cmsSchemas = await documents.find({ $or: [
      { 'modelOptions.conduit.cms.crudOperations': true },
      { 'modelOptions.conduit.cms.crudOperations': false },
    ]}).toArray();
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
    await documents.findOneAndUpdate({ _id: id }, {
      modelOptions: {
        conduit: { cms },
      },
    });
  }
}

module.exports = migateV12_V13;