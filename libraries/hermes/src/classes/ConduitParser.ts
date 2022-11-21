import {
  Array,
  ConduitModel,
  ConduitModelField,
  TYPE,
  ConduitRouteOption,
} from '@conduitplatform/grpc-sdk';

const baseTypes = ['String', 'Number', 'Boolean', 'Date', 'ObjectId', 'JSON'];

export abstract class ConduitParser<ParseResult, ProcessingObject> {
  result!: ParseResult;
  isInput!: boolean;
  readonly knownTypes: Set<string> = new Set();
  readonly requestedTypes: Set<string> = new Set();

  abstract extractTypes(
    name: string,
    fields: ConduitModel | ConduitRouteOption | string,
    isInput: boolean,
  ): ParseResult;

  protected abstract getType(conduitType: TYPE):
    | string
    | {
        type?: string;
        $ref?: string;
        format?: string;
        properties?: object;
      };

  protected abstract getInitializedResult(): ParseResult; // provides an (empty) initialized object of generic type ParseResult

  protected abstract getProcessingObject(
    name: string,
    isArray: boolean,
  ): ProcessingObject;

  protected abstract finalizeProcessingObject(object: ProcessingObject): ProcessingObject;

  protected abstract getResultFromString(
    processingObject: ProcessingObject,
    name: string,
    value: any,
    isRequired: boolean,
    isArray: boolean,
    parentField: string,
  ): void;

  protected abstract getResultFromObject(
    processingObject: ProcessingObject,
    name: string,
    fieldName: string,
    value: any,
    isRequired: boolean,
    isArray: boolean,
    description?: string,
  ): void;

  protected abstract getResultFromArray(
    processingObject: ProcessingObject,
    resolverName: string,
    name: string,
    value: any[],
    isRequired: boolean,
    nestedType?: boolean,
  ): void;

  protected abstract getResultFromRelation(
    processingObject: ProcessingObject,
    resolverName: string,
    name: string,
    value: any,
    isRequired: boolean,
    isArray: boolean,
  ): void;

  protected extractTypesInternal(
    name: string,
    fields: ConduitModel | ConduitRouteOption | string,
  ): ProcessingObject {
    let processingObject: ProcessingObject = this.getProcessingObject(name, false);
    if (typeof fields === 'string') {
      this.getResultFromString(
        processingObject,
        baseTypes.includes(fields) ? 'result' : name,
        fields,
        false,
        false,
        name,
      );
    } else {
      for (const field in fields) {
        if (!fields.hasOwnProperty(field)) continue;
        // if field is simply a type
        if (typeof fields[field] === 'string') {
          this.getResultFromString(
            processingObject,
            field,
            fields[field],
            false,
            false,
            name,
          );
        }
        // if field is an array
        else if (Array.isArray(fields[field])) {
          this.getResultFromArray(
            processingObject,
            name,
            field,
            fields[field] as Array,
            false,
          );
        } else if (typeof fields[field] === 'object') {
          // if it has "type" as a property we assume that the value is a string
          if ((fields[field] as any).type) {
            // if type is simply a type
            if (typeof (fields[field] as ConduitModelField).type === 'string') {
              if ((fields[field] as ConduitModelField).type === 'Relation') {
                this.getResultFromRelation(
                  processingObject,
                  name,
                  field,
                  (fields[field] as ConduitModelField).model,
                  (fields[field] as ConduitModelField).required!,
                  false,
                );
              } else {
                this.getResultFromString(
                  processingObject,
                  field,
                  (fields[field] as ConduitModelField).type,
                  (fields[field] as ConduitModelField).required!,
                  false,
                  name,
                );
              }
            }
            // if type is an array
            else if (Array.isArray((fields[field] as any).type)) {
              this.getResultFromArray(
                processingObject,
                name,
                field,
                (fields[field] as ConduitModelField).type as Array,
                (fields[field] as ConduitModelField).required!,
                true,
              );
            } else {
              this.getResultFromObject(
                processingObject,
                name,
                field,
                (fields[field] as ConduitModelField).type,
                (fields[field] as ConduitModelField).required!,
                false,
              );
            }
          } else {
            this.getResultFromObject(
              processingObject,
              name,
              field,
              fields[field] as ConduitModelField,
              false,
              false,
            );
          }
        }
      }
    }
    processingObject = this.finalizeProcessingObject(processingObject);
    return processingObject;
  }

  protected arrayHandler(name: string, field: string, value: Array): ProcessingObject {
    const processingObject: ProcessingObject = this.getProcessingObject(name, true);
    // if array contains simply a type
    if (typeof value[0] === 'string') {
      this.getResultFromString(processingObject, field, value[0], false, true, name);
    } else if (value[0].type) {
      // if array contains a model
      if (value[0].type === 'Relation') {
        this.getResultFromRelation(
          processingObject,
          name,
          field,
          value[0].model,
          value[0].required,
          true,
        );
      } else if (typeof value[0].type === 'string') {
        this.getResultFromString(
          processingObject,
          field,
          value[0].type,
          value[0].required,
          true,
          name,
        );
      } else if (Array.isArray(value[0].type)) {
        this.getResultFromArray(
          processingObject,
          name,
          field,
          value[0].type as Array,
          value[0].required,
          true,
        );
      }
      // if the array has "type" but is an object
      else {
        this.getResultFromObject(
          processingObject,
          name,
          field,
          value[0].type,
          value[0].required,
          true,
        );
      }
    }
    // if array contains an object
    else {
      this.getResultFromObject(processingObject, name, field, value[0], false, true);
    }
    return processingObject;
  }
}
