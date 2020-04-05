import {ClientOptions} from "memjs";

export interface MemcachedSettings {

    server: string;
    options: ClientOptions
}
