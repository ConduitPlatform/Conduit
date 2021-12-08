import { ConduitParser } from '../ConduitParser';
import { ConduitModel } from '@quintessential-sft/conduit-commons';

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
    let parentName = parent.slice(0, 1).toUpperCase() + parent.slice(1);
    return parentName + child.slice(0, 1).toUpperCase() + child.slice(1);
  }

  extractTypes(
    name: string,
    fields: ConduitModel | string,
    _input?: boolean
  ): ParseResult {
    this.result = this.getInitializedResult();
    let input = !!_input;
    this.result.typeString = super.extractTypesInternal(input, name, fields).finalString;
    return this.result;
  }

  addToRelation(result: ParseResult, name: string) {
    if (result.relationTypes.indexOf(name) === -1) {
      result.relationTypes.push(name);
    }
  }

  protected getProcessingObject(
    input: boolean,
    name: string,
    isArray: boolean
  ): ProcessingObject {
    return {
      finalString: '',
      typeString: isArray ? '' : ` ${input ? 'input' : 'type'} ${name} {`,
    };
  }

  protected finalizeProcessingObject(object: ProcessingObject): ProcessingObject {
    object.typeString += '} \n';
    object.finalString += object.typeString;
    return object;
  }

  protected getType(conduitType: any) {
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
        return conduitType;
    }
  }

  protected getResultFromString(
    processingObject: ProcessingObject,
    name: string,
    value: any,
    isRequired: boolean = false,
    isArray?: boolean
  ): void {
    processingObject.typeString +=
      `${name}: ${isArray ? '[' : ''}` +
      this.getType(value) +
      `${isArray ? `] ${isRequired ? '!' : ''}` : ''} `;
  }

  protected getResultFromObject(
    processingObject: ProcessingObject,
    input: boolean,
    name: string,
    value: any,
    isRequired: boolean = false,
    isArray?: boolean
  ): void {
    // object of some kind
    let nestedName = this.constructName(name, value);
    this.constructResolver(name, value);
    processingObject.typeString +=
      value +
      ': ' +
      ` ${isArray ? '[' : ''}` +
      nestedName +
      `${isArray ? `] ${isRequired ? '!' : ''}` : ''} `;
    processingObject.finalString +=
      ' ' + this.extractTypesInternal(input, nestedName, value).finalString + ' ';
  }

  protected getResultFromArray(
    processingObject: ProcessingObject,
    input: boolean,
    resolverName: string,
    name: string,
    value: any[],
    isRequired: boolean = false,
    nestedType?: boolean
  ): void {
    let arrayProcessing = super.arrayHandler(input, resolverName, name, value);
    if (nestedType) {
      processingObject.typeString +=
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
    input: boolean,
    resolverName: string,
    name: string,
    value: any,
    isRequired: boolean = false,
    isArray?: boolean
  ): void {
    this.addToRelation(this.result, value);
    this.constructResolver(resolverName, name, true);
    processingObject.typeString +=
      name +
      ': ' +
      ` ${isArray ? '[' : ''}` +
      (input ? 'ID' : value) +
      ` ${isArray ? ']' : ''}` +
      (isRequired ? '!' : '') +
      ' ';
  }

  protected getInitializedResult() {
    return {
      relationTypes: [],
      typeString: '',
      finalString: '',
      parentResolve: {},
    };
  }

  protected constructResolver(parent: string, fieldName: string, isRelation?: boolean) {
    if (!this.result.parentResolve[parent]) {
      this.result.parentResolve[parent] = {};
    }
    if (this.result.parentResolve[parent][fieldName]) return;
    if (isRelation) {
      this.result.parentResolve[parent][fieldName] = (parentObj: any) => {
        if (Array.isArray(parentObj[fieldName])) {
          if (typeof parentObj[fieldName][0] === 'string') {
            return parentObj[fieldName].map((obj: any) => {
              id: obj;
            });
          }
          return parentObj[fieldName];
        } else {
          if (typeof parentObj[fieldName] === 'string') {
            return { id: parentObj[fieldName] };
          }
          return parentObj[fieldName];
        }
      };
    } else {
      this.result.parentResolve[parent][fieldName] = (parentObj: any) => {
        return parentObj[fieldName];
      };
    }
  }
}
