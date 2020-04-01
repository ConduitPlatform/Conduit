export interface IStorageProvider {

    store(fileName: string, data: any): Promise<boolean | Error>;

    get(fileName: string): any;

}
