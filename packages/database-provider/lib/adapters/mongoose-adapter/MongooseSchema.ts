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
        return this.model.find(query).lean().exec();
    }

    findOne(query: any, select?: string): Promise<any> {
        return this.model.findOne(query, select).lean().exec();
    }

}
