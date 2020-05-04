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
        useCreateIndex: true,
        useFindAndModify: false
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
            // this.systemRequiredValidator(this.models[schema.name], schema);
            delete this.mongoose.connection.models[schema.name];
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

    deleteSchema(schemaName: string) {
        if (!this.models?.[schemaName]) throw ConduitError.notFound('Requested schema not found');
        if (this.models![schemaName].originalSchema.modelOptions.systemRequired) {
            throw ConduitError.forbidden("Can't delete system required schema");
        }
        delete this.models![schemaName];
        delete this.mongoose.connection.models[schemaName];
    }
    //
    // private systemRequiredValidator(oldSchema: MongooseSchema, newSchema: ConduitSchema): boolean {
    //     console.log('old', oldSchema)
    //     console.log('new', newSchema)
    //     if (!oldSchema.originalSchema.modelOptions.systemRequired) return true;
    //
    //     Object.keys(newSchema.fields).forEach(fieldKey => {
    //         if (!oldSchema.originalSchema.fields.hasOwnProperty(fieldKey)) {
    //             throw ConduitError.forbidden('Fields are missing on system required schema');
    //         }
    //         // if ()
    //     });
    //     console.log(oldSchema);
    //     return true;
    // }

}
