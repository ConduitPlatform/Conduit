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

    deleteOne(query: any): Promise<any> {
        return this.model.deleteOne(query).exec();
    }

    findMany(query: string): Promise<any> {
        return this.model.find(query).lean().exec();
    }

    findOne(query: any): Promise<any> {
        return this.model.findOne(query).lean().exec();
    }

}
