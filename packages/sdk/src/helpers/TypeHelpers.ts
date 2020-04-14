import {TYPE} from "../interaces";

function ConduitStringConstructor(): any
function ConduitStringConstructor(required: boolean): any
function ConduitStringConstructor(required?: boolean): any {
    if (required !== null && require !== undefined) {
        return {type: TYPE.String, required: required}
    } else {
        return TYPE.String;
    }
}


function ConduitNumberConstructor(): any
function ConduitNumberConstructor(required: boolean): any
function ConduitNumberConstructor(required?: boolean): any {
    if (required !== null && require !== undefined) {
        return {type: TYPE.Number, required: required}
    } else {
        return TYPE.Number;
    }
}

function ConduitBooleanConstructor(): any
function ConduitBooleanConstructor(required: boolean): any
function ConduitBooleanConstructor(required?: boolean): any {
    if (required !== null && require !== undefined) {
        return {type: TYPE.Boolean, required: required}
    } else {
        return TYPE.Boolean;
    }
}

function ConduitDateConstructor(): any
function ConduitDateConstructor(required: boolean): any
function ConduitDateConstructor(required?: boolean): any {
    if (required !== null && require !== undefined) {
        return {type: TYPE.Date, required: required}
    } else {
        return TYPE.Date;
    }
}

function ConduitObjectIdConstructor(): any
function ConduitObjectIdConstructor(required: boolean): any
function ConduitObjectIdConstructor(required?: boolean): any {
    if (required !== null && require !== undefined) {
        return {type: TYPE.ObjectId, required: required}
    } else {
        return TYPE.ObjectId;
    }
}

function ConduitJSONConstructor(): any
function ConduitJSONConstructor(required: boolean): any
function ConduitJSONConstructor(required?: boolean): any {
    if (required !== null && require !== undefined) {
        return {type: TYPE.JSON, required: required}
    } else {
        return TYPE.JSON;
    }
}

function ConduitRelationConstructor(model: string,): any
function ConduitRelationConstructor(model: string, required: boolean): any
function ConduitRelationConstructor(model: string, required?: boolean): any {
    if (required !== null && require !== undefined) {
        return {type: TYPE.Relation, model: model, required: required}
    } else {
        return {type: TYPE.Relation, model: model};
    }
}

export let ConduitNumber = ConduitNumberConstructor;
export let ConduitString = ConduitStringConstructor;
export let ConduitBoolean = ConduitBooleanConstructor;
export let ConduitDate = ConduitDateConstructor;
export let ConduitRelation = ConduitRelationConstructor;
export let ConduitJson = ConduitJSONConstructor;
export let ConduitObjectId = ConduitObjectIdConstructor;
