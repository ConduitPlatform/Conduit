export enum TYPE {
    String = 'String',
    Number = 'Number',
    Boolean = 'Boolean',
    Date = 'Date',
    ObjectId = 'ObjectId',
    JSON = 'Object'
}

export type Array = [];

export type ConduitModelField = {
    type?: TYPE | Array | ConduitModelField;
    default?: any
    required?: boolean
}

export interface ConduitModel {
    [field: string]: ConduitModelField | ConduitModel | TYPE
}

export interface ConduitModelOptions {
    timestamps?: boolean
}


