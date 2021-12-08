import { ConduitParser } from '../ConduitParser';
import { ConduitModel } from '@quintessential-sft/conduit-commons';
import { TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export interface ParseResult {
  type: string;
  format?: string;
  properties?: {};
  items?: {
    type: string;
    properties: {};
  };
}

export interface ProcessingObject {
  type: string;
  format?: string;
  properties?: {};
  items?: {
    type: string;
    properties: {};
  };
}

export class SwaggerParser extends ConduitParser<ParseResult, ProcessingObject> {
  extractTypes(
    name: string,
    fields: ConduitModel | string,
  ): ParseResult {
    return this._extractTypes(name, fields);
  }

  protected _extractTypes(
    name: string,
    fields: ConduitModel | string,
  ): ParseResult {
    this.result = this.getInitializedResult();
    this.result = super.extractTypesInternal(name, fields);
    return this.result;
  }

  protected getType(conduitType: any) {
    let res: { type: string; format?: string } = {
      type: '',
    };
    switch (conduitType) {
      case TYPE.JSON:
        res.type = 'object';
        break;
      case TYPE.Date:
        res.type = 'string';
        res.format = 'date-time';
        break;
      case TYPE.ObjectId:
      case TYPE.Relation:
        res.type = 'string';
        res.format = 'uuid';
        break;
      default:
        res.type = conduitType.toLowerCase();
    }
    return res;
  }

  protected getInitializedResult() {
    return {
      type: '',
    };
  }

  protected getProcessingObject(
    name: string,
    isArray: boolean
  ): ProcessingObject {
    return {
      type: '',
      format: '',
      properties: {},
      items: {
        type: '',
        properties: {},
      },
    };
  }

  protected finalizeProcessingObject(object: ProcessingObject): ProcessingObject {
    // Remove unused fields
    Object.keys(object).forEach((field: string) => {
      if (
        // @ts-ignore
        (typeof object[field] === 'string' && object[field] === '') ||
        // @ts-ignore
        (typeof object[field] === 'object' && Object.keys(object).length === 0)
      ) {
        // @ts-ignore
        delete object[field];
      }
    });
    return object;
  }

  protected getResultFromString(
    processingObject: ProcessingObject,
    name: string,
    value: any,
    isRequired: boolean = false,
    isArray: boolean
  ): void {
    // TODO: TEST ME ---------
    // this.getType(value);
    // place this^ inside processingObject
    // - 1. in .type
    // - 2. in items.type
  }

  protected getResultFromObject(
    processingObject: ProcessingObject,
    name: string,
    fieldName: string,
    value: any,
    isRequired: boolean = false,
    isArray: boolean
  ): void {
    // TODO: TEST ME ---------
  }

  protected getResultFromArray(
    processingObject: ProcessingObject,
    resolverName: string,
    name: string,
    value: any[],
    isRequired: boolean = false,
    nestedType?: boolean
  ): void {
    // TODO: TEST ME ---------
  }

  protected getResultFromRelation(
    processingObject: ProcessingObject,
    resolverName: string,
    name: string,
    value: any,
    isRequired: boolean = false,
    isArray: boolean
  ): void {
    // TODO: TEST ME ---------
  }

  // TODO: Remove me
  // public TEST_finalize() {
  //   console.log('Original, full of empty');
  //   const processingObj = this.getInitializedResult();
  //   console.log(processingObj);
  //
  //   console.log('Finalized (without changes), all removed');
  //   const finalized = this.finalizeProcessingObject(processingObj);
  //   console.log(finalized);
  //
  //   console.log('Added type, only that should remain');
  //   processingObj.type = 'string';
  //   const finalized2 = this.finalizeProcessingObject(processingObj);
  //   console.log(finalized2);
  // }
}

// TEST
const parser = new SwaggerParser();
// parser.TEST_finalize();

import { ConduitNumber } from '@quintessential-sft/conduit-grpc-sdk';
let resultObj = parser.extractTypes('User', {
  name: ConduitNumber.Required,
  // testArray: [{type: 'Relation', model: 'User', required: true}],
  // testArray2: [{type: 'Relation', model: 'User', required: false}],
  // testArray3: [{type: [{type: TYPE.String, required: true}], required: true}],
  likes: {type: [TYPE.String]},
  testObj: {type: {paparia: TYPE.String, poutses: TYPE.Number}, required: true},
  dislikes: {type: [{type: TYPE.Number, required: true}]}, // currently is interpreted as array required, when in reality the value inside is required
  // // dislikes2: {type: [{type: TYPE.Number, required: true}], required: true}, //currently not supported properly
  friends: [{username: TYPE.String, age: TYPE.Number, posts: {type: 'Relation', model: 'Posts'}}]
});
console.log(resultObj)
