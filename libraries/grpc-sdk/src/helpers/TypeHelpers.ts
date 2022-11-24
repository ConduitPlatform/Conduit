import { ConduitModelField, TYPE } from '../interfaces';

export class FieldConstructor {
  protected readonly type: string;
  protected readonly required: boolean;
  protected readonly description?: string;

  protected constructor(type: string, required: boolean, description?: string) {
    this.type = type;
    this.required = required;
    this.description = description;
  }

  construct() {
    return { type: this.type, required: this.required, description: this.description };
  }
}

class ConduitStringConstructor extends FieldConstructor {
  // private to disallow creating other instances of this type
  private constructor(required: boolean, description?: string) {
    super(TYPE.String, required, description);
  }

  static get Optional() {
    return new ConduitStringConstructor(false);
  }

  static get Required() {
    return new ConduitStringConstructor(true);
  }

  Description(description: string) {
    return new ConduitStringConstructor(this.required, description);
  }
}

export const ConduitString = ConduitStringConstructor;

class ConduitNumberConstructor extends FieldConstructor {
  // private to disallow creating other instances of this type
  private constructor(required: boolean, description?: string) {
    super(TYPE.Number, required, description);
  }

  static get Optional() {
    return new ConduitNumberConstructor(false);
  }

  static get Required() {
    return new ConduitNumberConstructor(true);
  }

  Description(description: string) {
    return new ConduitNumberConstructor(this.required, description);
  }
}

export const ConduitNumber = ConduitNumberConstructor;

class ConduitBooleanConstructor extends FieldConstructor {
  // private to disallow creating other instances of this type
  private constructor(required: boolean, description?: string) {
    super(TYPE.Boolean, required, description);
  }

  static get Optional() {
    return new ConduitBooleanConstructor(false);
  }

  static get Required() {
    return new ConduitBooleanConstructor(true);
  }

  Description(description: string) {
    return new ConduitBooleanConstructor(this.required, description);
  }
}

export const ConduitBoolean = ConduitBooleanConstructor;

class ConduitDateConstructor extends FieldConstructor {
  // private to disallow creating other instances of this type
  private constructor(required: boolean, description?: string) {
    super(TYPE.Date, required, description);
  }

  static get Optional() {
    return new ConduitDateConstructor(false);
  }

  static get Required() {
    return new ConduitDateConstructor(true);
  }

  Description(description: string) {
    return new ConduitDateConstructor(this.required, description);
  }
}

export const ConduitDate = ConduitDateConstructor;

class ConduitObjectIdConstructor extends FieldConstructor {
  // private to disallow creating other instances of this type
  private constructor(required: boolean, description?: string) {
    super(TYPE.ObjectId, required, description);
  }

  static get Optional() {
    return new ConduitObjectIdConstructor(false);
  }

  static get Required() {
    return new ConduitObjectIdConstructor(true);
  }

  Description(description: string) {
    return new ConduitObjectIdConstructor(this.required, description);
  }
}

export const ConduitObjectId = ConduitObjectIdConstructor;

class ConduitJSONConstructor extends FieldConstructor {
  // private to disallow creating other instances of this type
  private constructor(required: boolean, description?: string) {
    super(TYPE.JSON, required, description);
  }

  static get Optional() {
    return new ConduitJSONConstructor(false);
  }

  static get Required() {
    return new ConduitJSONConstructor(true);
  }

  Description(description: string) {
    return new ConduitJSONConstructor(this.required, description);
  }
}

export const ConduitJson = ConduitJSONConstructor;

class ConduitRelationConstructor {
  // private to disallow creating other instances of this type
  private constructor() {}

  static Optional(model: string): ConduitModelField {
    return { type: TYPE.Relation, model, required: false };
  }

  static Required(model: string): ConduitModelField {
    return { type: TYPE.Relation, model, required: true };
  }
}

export const ConduitRelation = ConduitRelationConstructor;
