const db = require('../mongoConnection');

const migrateV11_V15 = async () => {
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
    await documents.findOneAndUpdate(file.id, file);
  }
}

const migrate = async () => {
  return  migrateV11_V15();
}

migrate().then(r => console.log(r)).catch(e => console.log(e))