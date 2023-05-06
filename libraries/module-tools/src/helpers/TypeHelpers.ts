import {
  ConduitModelField,
  ConduitModelFieldJSON,
  ConduitModelFieldRelation,
  TYPE,
} from '@conduitplatform/grpc-sdk';

class ConduitStringConstructor {
  // private to disallow creating other instances of this type
  private constructor() {}

  static get Optional(): TYPE.String {
    return TYPE.String;
  }

  static get Required(): ConduitModelField {
    return { type: TYPE.String, required: true };
  }
}

export const ConduitString = ConduitStringConstructor;

class ConduitNumberConstructor {
  // private to disallow creating other instances of this type
  private constructor() {}

  static get Optional(): TYPE.Number {
    return TYPE.Number;
  }

  static get Required(): ConduitModelField {
    return { type: TYPE.Number, required: true };
  }
}

export const ConduitNumber = ConduitNumberConstructor;

class ConduitBooleanConstructor {
  // private to disallow creating other instances of this type
  private constructor() {}

  static get Optional(): TYPE.Boolean {
    return TYPE.Boolean;
  }

  static get Required(): ConduitModelField {
    return { type: TYPE.Boolean, required: true };
  }
}

export const ConduitBoolean = ConduitBooleanConstructor;

class ConduitDateConstructor {
  // private to disallow creating other instances of this type
  private constructor() {}

  static get Optional(): TYPE.Date {
    return TYPE.Date;
  }

  static get Required(): ConduitModelField {
    return { type: TYPE.Date, required: true };
  }
}

export const ConduitDate = ConduitDateConstructor;

class ConduitObjectIdConstructor {
  // private to disallow creating other instances of this type
  private constructor() {}

  static get Optional(): TYPE.ObjectId {
    return TYPE.ObjectId;
  }

  static get Required(): ConduitModelField {
    return { type: TYPE.ObjectId, required: true };
  }
}

export const ConduitObjectId = ConduitObjectIdConstructor;

class ConduitJSONConstructor {
  // private to disallow creating other instances of this type
  private constructor() {}

  static get Optional(): TYPE.JSON {
    return TYPE.JSON;
  }

  static get Required(): ConduitModelFieldJSON {
    return { type: TYPE.JSON, required: true };
  }
}

export const ConduitJson = ConduitJSONConstructor;

class ConduitRelationConstructor {
  // private to disallow creating other instances of this type
  private constructor() {}

  static Optional(model: string): ConduitModelFieldRelation {
    return { type: TYPE.Relation, model, required: false };
  }

  static Required(model: string): ConduitModelFieldRelation {
    return { type: TYPE.Relation, model, required: true };
  }
}

export const ConduitRelation = ConduitRelationConstructor;
