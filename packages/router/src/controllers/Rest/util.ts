import { Request } from 'express';
import { ConduitError, TYPE } from '@conduitplatform/conduit-grpc-sdk';
import { isArray, isNil, isObject } from 'lodash';

export function extractRequestData(req: Request) {
  const context = (req as any).conduit || {};
  let params: any = {};
  let headers: any = req.headers;
  if (req.query) {
    let newObj = {};
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
    Object.assign(params, newObj);
  }

  if (req.body) {
    Object.assign(params, req.body);
  }

  if (req.params) {
    Object.assign(params, req.params);
  }

  if (params.populate) {
    if (params.populate.includes(',')) {
      params.populate = params.populate.split(',');
    } else if (!Array.isArray(params.populate)) {
      params.populate = [params.populate];
    }
  }
  let path = req.baseUrl + req.path;
  return { context, params, headers, path };
}

export function validateParams(
  params: { [key: string]: any },
  routeDefinedParams: { [key: string]: any }
) {
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
          routeDefinedParams[key]?.required || false
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
  param: { [key: string]: any }[],
  routeDefinedArray: { [key: string]: any }[] | string[]
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
    if (!param) {
      return null;
    }
    param.forEach((obj: any, index: number) => {
      param[index] = validateType(`${fieldName}[${index}]`, type, obj, false);
    });

    return param;
  }
}

function validateObject(
  fieldName: string,
  param: { [key: string]: any },
  routeDefinedObject: { [key: string]: any }
) {
  if (routeDefinedObject.required && isNil(param)) {
    throw ConduitError.userInput(`${fieldName} is required`);
  } else if (isNil(param)) {
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
  required: boolean
): any {
  if (required && isNil(value)) {
    throw ConduitError.userInput(`${fieldName} is required`);
  } else if (isNil(value)) {
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
          `${fieldName} must be a string representation of a date, or a number timestamp`
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

export function extractRouteReturnProperties(returnDefinition: any) {
  if (typeof returnDefinition === 'string') {
    return extractReturnPropertiesFromType(returnDefinition);
  }

  return {
    type: 'object',
    properties: _extractRouteReturnProperties(returnDefinition),
  };
}

function _extractRouteReturnProperties(returnDefinition: any) {
  let result: any = {};

  for (const key of Object.keys(returnDefinition)) {
    if (isArray(returnDefinition[key])) {
      result[key] = extractReturnPropertiesFromArray(returnDefinition[key]);
    } else if (isObject(returnDefinition[key])) {
      result[key] = extractReturnPropertiesFromObject(returnDefinition[key]);
    } else {
      result[key] = extractReturnPropertiesFromType(returnDefinition[key]);
    }
  }

  return result;
}

function extractReturnPropertiesFromArray(returnDefinition: any[]) {
  let res: any = {
    type: 'array',
    items: {},
  };

  if (isObject(returnDefinition[0])) {
    res.items.type = 'object';
    res.items.properties = _extractRouteReturnProperties(returnDefinition[0]);
  } else {
    res.items = extractReturnPropertiesFromType(returnDefinition[0]);
  }

  return res;
}

function extractReturnPropertiesFromObject(returnDefinition: any) {
  let res: any;

  if (returnDefinition.hasOwnProperty('type')) {
    if (isObject(returnDefinition.type)) {
      res = {
        type: 'object',
        properties: _extractRouteReturnProperties(returnDefinition.type),
      };
    } else {
      res = extractReturnPropertiesFromType(returnDefinition.type);
    }
  } else {
    res = {
      type: 'object',
      properties: _extractRouteReturnProperties(returnDefinition),
    };
  }

  return res;
}

function extractReturnPropertiesFromType(returnDefinition: string) {
  let res: { type: string; format?: string } = {
    type: '',
  };

  switch (returnDefinition) {
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
      res.type = returnDefinition.toLowerCase();
  }

  return res;
}
