const db = require('../../mongoConnection');
const { isNil } = require('lodash');


const migrateV11_V15_customEndpoints = async () => {
  const documents = db.collection('customendpoints');
  const customEndpoints = await documents.find().toArray();
  for (const customEndpoint of customEndpoints) {
    if (!isNil(customEndpoint.queries) && isNil(customEndpoint.query)) {
      customEndpoint.query = { AND: customEndpoint.queries };
      await documents.updateMany(customEndpoint._id, customEndpoint);
    }
  }
}


const migrate = async () => {
  await migrateV11_V15_customEndpoints();
}

migrate().then(r => console.log(r)).catch(e => console.log(e))

