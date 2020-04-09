export interface ConduitRouteParameters {
    params?: { name: string, value: any }[];
    path?: string;
    context?: any;
}

export interface ConduitRouteOptionExtended {
    type: string;
    required: boolean;
}

export interface ConduitRouteOption {
    [field: string]: string | ConduitRouteOptionExtended
}

export enum ConduitRouteActions {
    GET = 'GET',
    POST = 'POST',
    UPDATE = 'PUT',
    DELETE = 'DELETE',

}

export interface ConduitRouteOptions {
    queryParams?: ConduitRouteOption;
    bodyParams?: ConduitRouteOption;
    urlParams?: ConduitRouteOption;
    action: ConduitRouteActions
    path: string;
    description?: string;
}

export class ConduitRouteReturnDefinition {

    private _name: string;
    private _fields: ConduitRouteOption | string;

    constructor(name: string, fields: ConduitRouteOption | string) {
        this._name = name;
        this._fields = fields;
    }

    get name(): string {
        return this._name;
    }

    get fields(): ConduitRouteOption | string {
        return this._fields;
    }

}

export class ConduitRoute {

    private _returnType: ConduitRouteReturnDefinition;
    private _input: ConduitRouteOptions;
    private _handler: (request: ConduitRouteParameters) => Promise<any>;

    constructor(input: ConduitRouteOptions, type: ConduitRouteReturnDefinition, handler: (request: ConduitRouteParameters) => Promise<any>) {
        this._input = input;
        this._returnType = type;
        this._handler = handler;
    }

    get returnTypeName(): string {
        return this._returnType.name;
    }

    get input(): ConduitRouteOptions {
        return this._input;
    }

    get returnTypeFields(): ConduitRouteOption | string {
        return this._returnType.fields;
    }

    executeRequest(request: ConduitRouteParameters): Promise<any> {
        return this._handler(request);
    }
}
