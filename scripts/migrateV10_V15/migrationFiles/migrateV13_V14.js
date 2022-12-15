import db from '../mongoConnection.js';

export async function migrateV13_V14() {
  const documents = db.collection('_declaredschemas');
  await documents.updateMany({ name: 'Client' }, { $set: { ownerModule: 'router' } });
};


