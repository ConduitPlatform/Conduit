import {ConduitModelField, TYPE} from "../interaces";

class ConduitStringConstructor {
    // private to disallow creating other instances of this type
    private constructor() {
    }

    static get Optional() {
        return TYPE.String
    }

    static get Required(): ConduitModelField {
        return {type: TYPE.Number, required: true}
    }
}


export let ConduitString = ConduitStringConstructor;

class ConduitNumberConstructor {
    // private to disallow creating other instances of this type
    private constructor() {
    }

    static get Optional() {
        return TYPE.Number
    }

    static get Required(): ConduitModelField {
        return {type: TYPE.Number, required: true}
    }
}


export let ConduitNumber = ConduitNumberConstructor;

class ConduitBooleanConstructor {
    // private to disallow creating other instances of this type
    private constructor() {
    }

    static get Optional() {
        return TYPE.Boolean
    }

    static get Required(): ConduitModelField {
        return {type: TYPE.Boolean, required: true}
    }
}


export let ConduitBoolean = ConduitBooleanConstructor;

class ConduitDateConstructor {
    // private to disallow creating other instances of this type
    private constructor() {
    }

    static get Optional() {
        return TYPE.Date
    }

    static get Required(): ConduitModelField {
        return {type: TYPE.Date, required: true}
    }
}


export let ConduitDate = ConduitDateConstructor;

class ConduitObjectIdConstructor {
    // private to disallow creating other instances of this type
    private constructor() {
    }

    static get Optional() {
        return TYPE.ObjectId
    }

    static get Required(): ConduitModelField {
        return {type: TYPE.ObjectId, required: true}
    }
}


export let ConduitObjectId = ConduitObjectIdConstructor;

class ConduitJSONConstructor {
    // private to disallow creating other instances of this type
    private constructor() {
    }

    static get Optional() {
        return TYPE.JSON
    }

    static get Required(): ConduitModelField {
        return {type: TYPE.JSON, required: true}
    }
}


export let ConduitJson = ConduitJSONConstructor;


class ConduitRelationConstructor {
    // private to disallow creating other instances of this type
    private constructor() {
    }

    static Optional(model: string): ConduitModelField {
        return {type: TYPE.Relation, model, required: false}
    }

    static Required(model: string): ConduitModelField {
        return {type: TYPE.Relation, model, required: true}
    }
}

export let ConduitRelation = ConduitRelationConstructor;
