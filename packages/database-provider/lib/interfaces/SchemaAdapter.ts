export interface SchemaAdapter {

    /**
     * The actual underlying model
     */
    model: any;

    /**
     * Should find one
     * @param query
     */
    findOne(query: any): Promise<any>;


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

}
