import {ConnectionOptions, Mongoose} from "mongoose"
import {MongooseSchema} from "./MongooseSchema";
import {schemaConverter} from "./SchemaConverter";
import {ConduitError, ConduitSchema, DatabaseAdapter, SchemaAdapter} from "@conduit/sdk";

export class MongooseAdapter implements DatabaseAdapter {

    mongoose: Mongoose;
    connectionString: string;
    options: ConnectionOptions = {
        autoReconnect: true,
        keepAlive: true,
        connectTimeoutMS: 30000,
        useNewUrlParser: true,
        useCreateIndex: true
    };
    models?: { [name: string]: MongooseSchema };

    constructor(connectionString: string) {
        this.connectionString = connectionString;
        this.mongoose = new Mongoose();
        this.mongoose.Promise = require("bluebird");
        this.connect();
    }

    connect() {
        this.mongoose
            .connect(this.connectionString, this.options)
            .then(() => {
                console.log('MongoDB dashboard is connected');
                let db = this.mongoose.connection;

                db.on('error', (err: any) => {
                    console.error('Dashboard Connection error:', err.message);
                });

                db.once('open', function callback() {
                    console.info("Connected to Dashboard Database!");
                });

                db.on('reconnected', function () {
                    console.log('Dashboard Database reconnected!');
                });

                db.on('disconnected', function () {
                    console.log('Dashboard Database Disconnected');

                });
            })
            .catch((err: any) => {
                console.log(err);
                throw new Error("Connection with Mongo not possible")
            });
    }

    createSchemaFromAdapter(schema: ConduitSchema): SchemaAdapter {
        const Schema = this.mongoose.Schema;
        if (!this.models) {
            this.models = {};
        }
        if (this.models[schema.name]) {
            return this.models[schema.name];
        }
        let newSchema = schemaConverter(schema);
        this.models[schema.name] = new MongooseSchema(this.mongoose, newSchema);
        return this.models[schema.name];
    }

    getSchema(schemaName: string): SchemaAdapter {
        if (this.models) {
            return this.models[schemaName]
        }
        throw new ConduitError("SchemaLookupError", 500, "Schema not defined yet!");
    }

}
