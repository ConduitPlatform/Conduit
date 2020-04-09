export enum TYPE {
    String = 'String',
    Number = 'Number',
    Boolean = 'Boolean',
    Date = 'Date',
    ObjectId = 'ObjectId',
    JSON = 'JSON',
    Relation = 'Relation'
}

export type Array = [];

export type ConduitModelField = {
    type?: TYPE | Array | ConduitModelField;
    default?: any
    model?: string
    unique?: boolean
    select?: boolean
    required?: boolean
}

export interface ConduitModel {
    [field: string]: ConduitModelField | ConduitModelField[] | ConduitModel | TYPE | TYPE[] | any[]
}

export interface ConduitModelOptions {
    timestamps?: boolean
}


