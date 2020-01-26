import {SchemaAdapter} from "../../interfaces/SchemaAdapter";
import {Model} from "mongoose";

export class MongooseSchema implements SchemaAdapter {

    model: Model<any>;

    constructor(mongooseModel: any) {
        this.model = mongooseModel;
    }

    create(query: string): Promise<any> {
        return this.model.create(query);
    }

    findMany(query: string): Promise<any> {
        return new Promise((resolve, reject) => {

        });
    }

    findOne(query: any): Promise<any> {
        return new Promise((resolve, reject) => {

        });
    }

}
