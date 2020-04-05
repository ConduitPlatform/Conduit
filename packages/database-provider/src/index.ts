import {DatabaseAdapter} from "./interfaces/DatabaseAdapter";
import {MongooseAdapter} from "./adapters/mongoose-adapter";

let activeAdapter: DatabaseAdapter;

export async function connectToDB(dbType: string, databaseUrl: any) {

    if (dbType === 'mongodb') {
        activeAdapter = new MongooseAdapter(databaseUrl);
        return activeAdapter;
    } else {
        return null;
    }

}

export function getDbAdapter(): DatabaseAdapter {

    return activeAdapter;
}
