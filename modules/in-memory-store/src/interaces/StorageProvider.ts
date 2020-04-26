export interface StorageProvider {

    store(key: string, value: any): Promise<any>;

    get(key: string): Promise<any>;
}
