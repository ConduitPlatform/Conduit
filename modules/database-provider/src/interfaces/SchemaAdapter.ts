export interface SchemaAdapter {

    /**
     * The actual underlying model
     */
    model: any;
    /**
     * The original model used to generate this
     */
    originalSchema: string; // TODO this is string for now since ConduitSchema used to be in the sdk

    /**
     * Should find one
     * @param query
     * @param select
     */
    findOne(query: any, select?: string): Promise<any>;


    /**
     * Should find Many
     * @param query
     * @param skip
     * @param limit
     * @param select
     * @param sort
     */
    findMany(query: any, skip?: number, limit?: number, select?: string, sort?: any): Promise<any>;

    /**
     * Should create
     * @param query
     */
    create(query: any): Promise<any>;

    deleteOne(query: any): Promise<any>

    deleteMany(query: any): Promise<any>;

    findByIdAndUpdate(id:any, document: any): Promise<any>;

    updateMany(filterQuery: any, query: any): Promise<any>;

    countDocuments(query: any): Promise<number>;

}
