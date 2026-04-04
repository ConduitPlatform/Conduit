import {
  Array,
  ConduitModel,
  ConduitModelField,
  ConduitModelFieldRelation,
  ConduitReturn,
  TYPE,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { ParserUtils } from './ParserUtils.js';

const baseTypes = ['String', 'Number', 'Boolean', 'Date', 'ObjectId', 'JSON'];

export abstract class ConduitParser<ParseResult, ProcessingObject> {
  result!: ParseResult;
  isInput!: boolean;
  readonly knownTypes: Set<string> = new Set();
  readonly requestedTypes: Set<string> = new Set();

  abstract extractTypes(
    name: string,
    fields: ConduitModel | ConduitReturn,
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
    description?: string,
    sourceField?: unknown,
  ): void;

  protected abstract getResultFromObject(
    processingObject: ProcessingObject,
    name: string,
    fieldName: string,
    value: any,
    isRequired: boolean,
    isArray: boolean,
    description?: string,
    sourceField?: unknown,
  ): void;

  protected abstract getResultFromArray(
    processingObject: ProcessingObject,
    resolverName: string,
    name: string,
    value: UntypedArray,
    isRequired: boolean,
    nestedType?: boolean,
    description?: string,
    sourceField?: unknown,
  ): void;

  protected abstract getResultFromRelation(
    processingObject: ProcessingObject,
    resolverName: string,
    name: string,
    value: any,
    isRequired: boolean,
    isArray: boolean,
    sourceField?: unknown,
  ): void;

  protected extractTypesInternal(
    name: string,
    fields: ConduitModel | ConduitReturn,
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
            (fields[field] as ConduitModelField).description!,
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
            undefined,
            undefined,
            fields[field],
          );
        } else if (typeof fields[field] === 'object') {
          // if it has "type" as a property we assume that the value is a string
          if (ParserUtils.hasTypeProperty(fields[field])) {
            const baseType = ParserUtils.getBaseType(fields[field]);
            const isRequired = ParserUtils.isFieldRequired(fields[field]);
            const description = ParserUtils.getFieldDescription(fields[field]);

            // if type is simply a type
            if (typeof baseType === 'string') {
              if (ParserUtils.isRelationType(fields[field])) {
                const model = ParserUtils.getRelationModel(fields[field]);
                this.getResultFromRelation(
                  processingObject,
                  name,
                  field,
                  model!,
                  isRequired,
                  false,
                  fields[field],
                );
              } else {
                this.getResultFromString(
                  processingObject,
                  field,
                  baseType,
                  isRequired,
                  false,
                  name,
                  description,
                  fields[field],
                );
              }
            }
            // if type is an array
            else if (Array.isArray(baseType)) {
              this.getResultFromArray(
                processingObject,
                name,
                field,
                baseType as Array,
                isRequired,
                true,
                description,
                fields[field],
              );
            } else {
              this.getResultFromObject(
                processingObject,
                name,
                field,
                baseType,
                isRequired,
                false,
                description,
                fields[field],
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
              ParserUtils.getFieldDescription(fields[field]),
              fields[field],
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
    } else if (ParserUtils.hasTypeProperty(value[0])) {
      const baseType = ParserUtils.getBaseType(value[0]);
      const isRequired = ParserUtils.isFieldRequired(value[0]);
      const description = ParserUtils.getFieldDescription(value[0]);

      // if array contains a model
      if (ParserUtils.isRelationType(value[0])) {
        const model = ParserUtils.getRelationModel(value[0]);
        this.getResultFromRelation(
          processingObject,
          name,
          field,
          model!,
          isRequired,
          true,
          value[0],
        );
      } else if (typeof baseType === 'string') {
        this.getResultFromString(
          processingObject,
          field,
          baseType,
          isRequired,
          true,
          name,
          description,
          value[0],
        );
      } else if (Array.isArray(baseType)) {
        this.getResultFromArray(
          processingObject,
          name,
          field,
          baseType as Array,
          isRequired,
          true,
          description,
          value[0],
        );
      }
      // if the array has "type" but is an object
      else {
        this.getResultFromObject(
          processingObject,
          name,
          field,
          baseType,
          isRequired,
          true,
          description,
          value[0],
        );
      }
    }
    // if array contains an object
    else {
      this.getResultFromObject(
        processingObject,
        name,
        field,
        value[0],
        false,
        true,
        undefined,
        value[0],
      );
    }
    return processingObject;
  }
}
