import {ConduitSchema} from "../../../models";

export interface SchemaAdapter {

    /**
     * The actual underlying model
     */
    model: any;
    /**
     * The original model used to generate this
     */
    originalSchema: ConduitSchema;

    /**
     * Should find one
     * @param query
     * @param select
     */
    findOne(query: any, select?: string): Promise<any>;


    /**
     * Should find Many
     * @param query
     */
    findMany(query: any): Promise<any>;

    /**
     * Should create
     * @param query
     */
    create(query: any): Promise<any>;

    createMany(query: any): Promise<any>;

    deleteOne(query: any): Promise<any>;

    deleteMany(query: any): Promise<any>;

    findByIdAndUpdate(id: any, query: any): Promise<any>;

    updateMany(filterQuery: any, query: any): Promise<any>;

    findPaginated(query: any, skip: number, limit: number): Promise<any>;

    countDocuments(query: any): Promise<number>;

}
