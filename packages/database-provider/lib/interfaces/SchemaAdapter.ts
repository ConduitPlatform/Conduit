export interface SchemaAdapter {

    /**
     * The actual underlying model
     */
    model: any;

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
    findMany(query: string): Promise<any>;

    /**
     * Should create
     * @param query
     */
    create(query: string): Promise<any>;

    deleteOne(query: any): Promise<any>;

    findByIdAndUpdate(document: any): Promise<any>;

}
