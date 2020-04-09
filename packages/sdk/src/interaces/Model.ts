export enum TYPE {
    String = 'String',
    Number = 'Number',
    Boolean = 'Boolean',
    Date = 'Date',
    ObjectId = 'ObjectId',
    JSON = 'JSON',
    Relation = 'Relation'
}

export type Array = any[];

export type ConduitModelField = {
    type?: TYPE | Array | ConduitModelField;
    enum?: any
    default?: any
    model?: string
    unique?: boolean
    select?: boolean
    required?: boolean
}

export interface ConduitModel {
    [field: string]: ConduitModelField | ConduitModel | TYPE
}

export interface ConduitModelOptions {
    timestamps?: boolean
}


