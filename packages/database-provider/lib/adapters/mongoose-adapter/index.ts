import {ConnectionOptions, Mongoose} from "mongoose"
import {DatabaseAdapter} from "../../interfaces/DatabaseAdapter";
import {MongooseSchema} from "./MongooseSchema";
import {SchemaAdapter} from "../../interfaces/SchemaAdapter";
import {schemaConverter} from "./SchemaConverter";

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
    models: any;

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

    createSchemaFromAdapter(schema: any): SchemaAdapter {
        const Schema = this.mongoose.Schema;
        if (!this.models) {
            this.models = {};
        }
        let newSchema = schemaConverter(schema);
        this.models[schema.name] = new MongooseSchema(this.mongoose.model(newSchema.name, new Schema(newSchema.model, newSchema.modelOptions)));
        return this.models[schema.name];
    }

    getSchema(schemaName: string): SchemaAdapter {
        return this.models[schemaName]
    }

}
