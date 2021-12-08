import { ConduitModel } from '@quintessential-sft/conduit-commons';

// TODO:
// - Test GraphQlParser
// - Implement SwaggerParser
// - Test SwaggerParser

export abstract class ConduitParser<ParseResult, ProcessingObject> {
  result!: ParseResult;

  abstract extractTypes(
    name: string,
    fields: ConduitModel | string,
    _input?: boolean
  ): ParseResult;

  protected abstract getType(conduitType: any): string | any;

  protected abstract getInitializedResult(): ParseResult; // provides an (empty) initialized object of generic type ParseResult

  protected abstract getProcessingObject(
    input: boolean,
    name: string,
    isArray?: boolean
  ): ProcessingObject;

  protected abstract finalizeProcessingObject(object: ProcessingObject): ProcessingObject;

  protected abstract getResultFromString(
    processingObject: ProcessingObject,
    name: string,
    value: any,
    isRequired: boolean,
    isArray?: boolean
  ): void;

  protected abstract getResultFromObject(
    processingObject: ProcessingObject,
    input: boolean,
    name: string,
    value: any,
    isRequired: boolean,
    isArray?: boolean
  ): void;

  protected abstract getResultFromArray(
    processingObject: ProcessingObject,
    input: boolean,
    resolverName: string,
    name: string,
    value: any[],
    isRequired: boolean,
    nestedType?: boolean
  ): void;

  protected abstract getResultFromRelation(
    processingObject: ProcessingObject,
    input: boolean,
    resolverName: string,
    name: string,
    value: any,
    isRequired: boolean,
    isArray?: boolean
  ): void;

  protected extractTypesInternal(
    input: boolean,
    name: string,
    fields: ConduitModel | string
  ): ProcessingObject {
    let processingObject: ProcessingObject = this.getProcessingObject(input, name);
    if (typeof fields === 'string') {
      this.getResultFromString(processingObject, 'result', fields, false);
    } else {
      for (let field in fields) {
        if (!fields.hasOwnProperty(field)) continue;
        // if field is simply a type
        if (typeof fields[field] === 'string') {
          this.getResultFromString(processingObject, field, fields[field], false);
        }
        // if field is an array
        else if (Array.isArray(fields[field])) {
          this.getResultFromArray(
            processingObject,
            input,
            name,
            field,
            fields[field] as Array<any>,
            false
          );
        } else if (typeof fields[field] === 'object') {
          // if it has "type" as a property we assume that the value is a string
          if ((fields[field] as any).type) {
            // if type is simply a type
            if (typeof (fields[field] as any).type === 'string') {
              if ((fields[field] as any).type === 'Relation') {
                this.getResultFromRelation(
                  processingObject,
                  input,
                  name,
                  field,
                  (fields[field] as any).model,
                  (fields[field] as any).required
                );
              } else {
                this.getResultFromString(
                  processingObject,
                  field,
                  (fields[field] as any).type,
                  (fields[field] as any).required
                );
              }
            }
            // if type is an array
            else if (Array.isArray((fields[field] as any).type)) {
              this.getResultFromArray(
                processingObject,
                input,
                name,
                field,
                (fields[field] as any).type as Array<any>,
                (fields[field] as any).required,
                true
              );
            } else {
              this.getResultFromObject(
                processingObject,
                input,
                name,
                (fields[field] as any).type,
                (fields[field] as any).required
              );
            }
          } else {
            this.getResultFromObject(
              processingObject,
              input,
              name,
              fields[field] as any,
              false
            );
          }
        }
      }
    }
    processingObject = this.finalizeProcessingObject(processingObject);
    return processingObject;
  }

  protected arrayHandler(
    input: boolean,
    name: string,
    field: string,
    value: Array<any>
  ): ProcessingObject {
    let processingObject: ProcessingObject = this.getProcessingObject(input, name, true);
    // if array contains simply a type
    if (typeof value[0] === 'string') {
      this.getResultFromString(processingObject, field, value[0], false, true);
    } else if (value[0].type) {
      // if array contains a model
      if (value[0].type === 'Relation') {
        this.getResultFromRelation(
          processingObject,
          input,
          name,
          field,
          value[0].model,
          value[0].required,
          true
        );
      } else if (typeof value[0].type === 'string') {
        this.getResultFromString(
          processingObject,
          field,
          value[0].type,
          value[0].required,
          true
        );
      } else if (Array.isArray(value[0].type)) {
        this.getResultFromArray(
          processingObject,
          input,
          name,
          field,
          value[0].type as Array<any>,
          value[0].required,
          true
        );
      }
      // if the array has "type" but is an object
      else {
        this.getResultFromObject(
          processingObject,
          input,
          name,
          value[0].type,
          value[0].required,
          true
        );
      }
    }
    // if array contains an object
    else {
      this.getResultFromObject(processingObject, input, name, value[0], false, true);
    }
    return processingObject;
  }
}
