import { Request } from 'express';
import {
  BodyParams,
  ConduitError,
  Indexable,
  Params,
  QueryParams,
  TYPE,
  UrlParams,
} from '@conduitplatform/grpc-sdk';
import { isArray, isNil, isObject } from 'lodash';

type ConduitRequest = Request & { conduit?: Indexable };

export function extractRequestData(req: ConduitRequest) {
  const context = req.conduit || {};
  const urlParams: UrlParams = {};
  const queryParams: QueryParams = {};
  const bodyParams: BodyParams = {};
  const headers = req.headers;
  const cookies = req.cookies;
  if (req.query) {
    const newObj = {};
    Object.keys(req.query).forEach((k: string) => {
      if (!req.query.hasOwnProperty(k)) return;
      // @ts-ignore
      if (!Array.isArray(req.query) && req.query[k].indexOf(',') !== -1) {
        // @ts-ignore
        newObj[k] = req.query[k].split(',');
      } else {
        // @ts-ignore
        newObj[k] = req.query[k];
      }
    });
    Object.assign(queryParams, newObj);
  }

  if (req.body) {
    Object.assign(bodyParams, req.body);
  }

  if (req.params) {
    Object.assign(urlParams, req.params);
  }

  if (queryParams.populate) {
    if (typeof queryParams.populate === 'string' && queryParams.populate.includes(',')) {
      queryParams.populate = queryParams.populate.split(',');
    } else if (!Array.isArray(queryParams.populate)) {
      queryParams.populate = [queryParams.populate];
    }
  }
  const path = req.baseUrl + req.path;
  return { context, headers, cookies, path, urlParams, queryParams, bodyParams };
}

export function validateParams(params: Params, routeDefinedParams: Params) {
  for (const key of Object.keys(routeDefinedParams)) {
    if (
      isArray(routeDefinedParams[key]) ||
      (routeDefinedParams[key].type && isArray(routeDefinedParams[key].type))
    ) {
      params[key] = validateArray(key, params[key], routeDefinedParams[key]);
    } else if (isObject(routeDefinedParams[key])) {
      if (routeDefinedParams[key].hasOwnProperty('type')) {
        params[key] = validateType(
          key,
          routeDefinedParams[key].type,
          params[key],
          routeDefinedParams[key]?.required || false,
        );
      } else {
        validateObject(key, params[key], routeDefinedParams[key]);
      }
    } else {
      params[key] = validateType(key, routeDefinedParams[key], params[key], false);
    }
  }
}

function validateArray(
  fieldName: string,
  param: Params[],
  routeDefinedArray: Indexable[] | string[],
) {
  const type = routeDefinedArray[0];
  if (isObject(type)) {
    if (type.required && isNil(param)) {
      throw ConduitError.userInput(`${fieldName} is required`);
    }
  } else {
    if (!isArray(param)) {
      if (param) {
        param = [param];
      }
      // throw ConduitError.userInput(`${fieldName} must be an array`);
    }
    if (param === null) {
      return null;
    } else if (param === undefined) {
      return;
    }
    param.forEach((obj: any, index: number) => {
      param[index] = validateType(`${fieldName}[${index}]`, type, obj, false);
    });
  }
  return param;
}

function validateObject(fieldName: string, param: Params, routeDefinedObject: Params) {
  if (routeDefinedObject.required && isNil(param)) {
    throw ConduitError.userInput(`${fieldName} is required`);
  } else if (param === null) {
    return param;
  } else if (param === undefined) {
    return;
  }

  if (!isObject(param) || isArray(param)) {
    throw ConduitError.userInput(`${fieldName} must be an object`);
  }
  validateParams(param, routeDefinedObject);
}

function validateType(
  fieldName: string,
  paramType: string,
  value: unknown,
  required: boolean,
): any {
  if (required && isNil(value)) {
    throw ConduitError.userInput(`${fieldName} is required`);
  } else if (value === null) {
    return value;
  } else if (value === undefined) {
    return;
  }

  switch (paramType) {
    case TYPE.String:
      if (typeof value !== 'string')
        throw ConduitError.userInput(`${fieldName} must be a string`);
      break;
    case TYPE.Number:
      if (typeof value === 'string') {
        value = Number(value);
        if (Number.isNaN(value)) {
          throw ConduitError.userInput(`${fieldName} must be a number`);
        }
      } else if (typeof value !== 'number') {
        throw ConduitError.userInput(`${fieldName} must be a number`);
      }
      break;
    case TYPE.Boolean:
      if (typeof value === 'string') {
        value = value.toLowerCase();
        if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else {
          throw ConduitError.userInput(`${fieldName} must be a boolean`);
        }
      } else if (typeof value !== 'boolean') {
        throw ConduitError.userInput(`${fieldName} must be a boolean`);
      }
      break;
    case TYPE.Date:
      if (typeof value !== 'string' && typeof value !== 'number') {
        throw ConduitError.userInput(
          `${fieldName} must be a string representation of a date, or a number timestamp`,
        );
      }

      value = new Date(value);
      if (!(value instanceof Date)) {
        throw ConduitError.userInput(`${fieldName} has an invalid date format`);
      }
      if (!isValidDate(value)) {
        throw ConduitError.userInput(`${fieldName} has an invalid date format`);
      }
      break;
    case TYPE.ObjectId:
      if (typeof value !== 'string')
        throw ConduitError.userInput(`${fieldName} must be a string`);
      break;
  }

  return value;
}

function isValidDate(date: Date): boolean {
  return !isNaN(date.getHours());
}
