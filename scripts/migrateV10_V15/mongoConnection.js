import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.DB_CONN_URI);
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

const db = client.db(process.env.DB_NAME);
export default db;












