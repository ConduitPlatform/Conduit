import {IStorageProvider} from "../../interfaces/IStorageProvider";

export class LocalStorage implements IStorageProvider {

    get(fileName: string): any {
    }

    store(fileName: string, data: any): Promise<boolean | Error> {
        return new Promise((resolve) => {
            resolve();
        });
    }

}
