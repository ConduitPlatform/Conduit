const db = require('../mongoConnection');

const migrateV13_V14 = async () => {
  const documents = db.collection('_declaredschemas');
  await documents.updateMany({ name: 'Client' }, { $set: { ownerModule: 'router' } });
};


module.exports = migrateV13_V14;