import {
  ConduitModel,
  ConduitReturn,
  Indexable,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { ConduitParser, TypeRegistry } from '../classes';

export interface ResolverDefinition {
  [key: string]: {
    [key: string]: (parent: any) => any;
  };
}

export interface ParseResult {
  relationTypes: string[];
  typeString: string;
  parentResolve: ResolverDefinition;
}

export interface ProcessingObject {
  finalString: string;
  typeString: string;
}

export class GraphQlParser extends ConduitParser<ParseResult, ProcessingObject> {
  constructName(parent: string, child: string) {
    const parentName = parent.slice(0, 1).toUpperCase() + parent.slice(1);
    return parentName + child.slice(0, 1).toUpperCase() + child.slice(1);
  }

  extractTypes(
    name: string,
    fields: ConduitModel | ConduitReturn,
    isInput: boolean,
  ): ParseResult {
    if (!isInput) this.knownTypes.add(name);
    this.isInput = isInput;
    this.result = this.getInitializedResult();
    this.result.typeString = super.extractTypesInternal(name, fields).finalString;
    return this.result;
  }

  addToRelation(result: ParseResult, name: string) {
    if (result.relationTypes.indexOf(name) === -1) {
      result.relationTypes.push(name);
    }
  }

  protected getProcessingObject(name: string, isArray: boolean): ProcessingObject {
    return {
      finalString: '',
      typeString: isArray ? '' : ` ${this.isInput ? 'input' : 'type'} ${name} {`,
    };
  }

  protected finalizeProcessingObject(object: ProcessingObject): ProcessingObject {
    object.typeString += '} \n';
    object.finalString += object.typeString;
    return object;
  }

  protected getType(conduitType: string) {
    switch (conduitType) {
      case 'String':
        return conduitType;
      case 'Number':
        return 'Number';
      case 'Boolean':
        return conduitType;
      case 'Date':
        return conduitType;
      case 'ObjectId':
        return 'ID';
      case 'JSON':
        return 'JSONObject';
      default:
        this.requestedTypes.add(conduitType);
        return conduitType;
    }
  }

  protected getResultFromString(
    processingObject: ProcessingObject,
    name: string,
    value: string,
    isRequired: boolean,
    isArray: boolean,
    parentField: string,
    description?: string,
  ): void {
    if (!isArray && name === parentField) {
      const typeFields = TypeRegistry.getInstance().getType(value);
      if (typeFields) {
        processingObject.typeString = this.extractTypes(
          name,
          typeFields,
          false,
        ).typeString;
      } else {
        processingObject.typeString = ''; // missing type
      }
    } else {
      processingObject.typeString +=
        (description ? `""" ${description} """ ` : '') +
        `${name}: ${isArray ? '[' : ''}` +
        this.getType(value) +
        `${isArray ? `${isRequired ? '!' : ''}]` : ''} `;
    }
  }

  protected getResultFromObject(
    processingObject: ProcessingObject,
    name: string,
    fieldName: string,
    value: ConduitModel | ConduitReturn,
    isRequired: boolean = false,
    isArray: boolean,
    description?: string,
  ): void {
    // object of some kind
    const nestedName = this.constructName(name, fieldName);
    this.constructResolver(name, fieldName);
    processingObject.typeString +=
      (description ? `""" ${description} """ ` : '') +
      fieldName +
      ': ' +
      `${isArray ? '[' : ''}` +
      nestedName +
      `${isArray ? `${isRequired ? '!' : ''}]` : ''} `;
    processingObject.finalString +=
      ' ' + this.extractTypesInternal(nestedName, value).finalString + ' ';
  }

  protected getResultFromArray(
    processingObject: ProcessingObject,
    resolverName: string,
    name: string,
    value: UntypedArray,
    isRequired: boolean = false,
    nestedType?: boolean,
    description?: string,
  ): void {
    const arrayProcessing = super.arrayHandler(resolverName, name, value);
    if (nestedType) {
      processingObject.typeString +=
        `""" ${description} """ ` +
        arrayProcessing.typeString.slice(0, arrayProcessing.typeString.length - 1) +
        (isRequired ? '!' : '') +
        ' ';
    } else {
      processingObject.typeString += arrayProcessing.typeString;
    }
    processingObject.finalString += arrayProcessing.finalString;
  }

  protected getResultFromRelation(
    processingObject: ProcessingObject,
    resolverName: string,
    name: string,
    value: string,
    isRequired: boolean = false,
    isArray: boolean,
  ): void {
    this.addToRelation(this.result, value);
    this.requestedTypes.add(value);
    this.constructResolver(resolverName, name, true);
    processingObject.typeString +=
      name +
      ': ' +
      `${isArray ? '[' : ''}` +
      (this.isInput ? 'ID' : value) +
      `${isArray ? ']' : ''}` +
      (isRequired ? '!' : '') +
      ' ';
  }

  protected getInitializedResult() {
    return {
      relationTypes: [],
      typeString: '',
      parentResolve: {},
    };
  }

  protected constructResolver(parent: string, fieldName: string, isRelation?: boolean) {
    if (!this.result.parentResolve[parent]) {
      this.result.parentResolve[parent] = {};
    }
    if (this.result.parentResolve[parent][fieldName]) return;
    if (isRelation) {
      this.result.parentResolve[parent][fieldName] = (parentObj: Indexable) => {
        if (Array.isArray(parentObj[fieldName])) {
          if (typeof parentObj[fieldName][0] === 'string') {
            return parentObj[fieldName].map((obj: Indexable) => {
              _id: obj;
            });
          }
          return parentObj[fieldName];
        } else {
          if (typeof parentObj[fieldName] === 'string') {
            return { _id: parentObj[fieldName] };
          }
          return parentObj[fieldName];
        }
      };
    } else {
      this.result.parentResolve[parent][fieldName] = (parentObj: Indexable) => {
        return parentObj[fieldName];
      };
    }
  }
}
