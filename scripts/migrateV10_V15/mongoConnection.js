const { MongoClient } = require('mongodb');

const client = new MongoClient('mongodb://localhost:27017');
async function connect() {
  try{
    await client.connect();
    console.log('Connected to MongoDB');
  }
  catch(e){
    console.log('Error connecting to MongoDB');
    console.log(e);
  }
}

connect().then(r => console.log(r)).catch(e => console.log(e))


module.exports = client.db('test')












