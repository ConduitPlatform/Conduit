import { TYPE } from '@conduitplatform/grpc-sdk';

class ConduitStringConstructor {
  // private to disallow creating other instances of this type
  private constructor() {}

  static get Optional(): TYPE.String {
    return TYPE.String;
  }

  static get Required(): { type: TYPE.String; required: true } {
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

  static get Required(): { type: TYPE.Number; required: true } {
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

  static get Required(): { type: TYPE.Boolean; required: true } {
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

  static get Required(): { type: TYPE.Date; required: true } {
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

  static get Required(): { type: TYPE.ObjectId; required: true } {
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

  static get Required(): { type: TYPE.JSON; required: true } {
    return { type: TYPE.JSON, required: true };
  }
}

export const ConduitJson = ConduitJSONConstructor;

class ConduitRelationConstructor {
  // private to disallow creating other instances of this type
  private constructor() {}

  static Optional(model: string): {
    type: TYPE.Relation;
    model: string;
    required: false;
  } {
    return { type: TYPE.Relation, model, required: false };
  }

  static Required(model: string): { type: TYPE.Relation; model: string; required: true } {
    return { type: TYPE.Relation, model, required: true };
  }
}

export const ConduitRelation = ConduitRelationConstructor;
