import { ConduitModel, TYPE } from '@conduitplatform/grpc-sdk';

function extractParam(param: string, required: boolean = false) {
  const res: { type: string; format?: string; required?: boolean } = { type: 'string' };
  switch (param) {
    case TYPE.JSON:
      res.type = 'object';
      res.required = required;
      break;
    case TYPE.Date:
      res.type = 'string';
      res.format = 'date-time';
      res.required = required;

      break;
    case TYPE.ObjectId:
    case TYPE.Relation:
      res.type = 'string';
      res.format = 'uuid';
      res.required = required;

      break;
    case 'String':
    case 'Number':
    case 'Boolean':
      res.type = param.toLowerCase();
      res.required = required;
      break;
  }
  return res;
}

function extractArrayParam(param: string, required: boolean = false) {
  return {
    type: 'array',
    items: { ...extractParam(param, required) },
    minItems: required ? 1 : 0,
  };
}

export function processSwaggerParams(paramObj: any) {
  let params: { type: string; items?: any; minItems?: number } | {} = {};

  if (typeof paramObj === 'string') {
    params = extractParam(paramObj);
  } else if (Array.isArray(paramObj)) {
    const elementZero = paramObj[0];
    if (typeof elementZero === 'string') {
      params = {
        type: 'array',
        items: { ...extractParam(elementZero, false) },
        minItems: 0,
      };
    } else {
      const typeZero = (elementZero as ConduitModel).type;
      const typeZeroRequired = (elementZero as ConduitModel).required;
      params = {
        type: 'array',
        items: { ...extractParam(typeZero!, typeZeroRequired) },
        minItems: typeZeroRequired ? 1 : 0,
      };
    }
  } else {
    const typeZero = (paramObj as ConduitModel).type;
    const typeZeroRequired = (paramObj as ConduitModel).required;
    if (typeof typeZero === 'string') {
      params = extractParam(typeZero, typeZeroRequired);
    } else if (Array.isArray(typeZero)) {
      const elementZero = typeZero[0];
      if (typeof elementZero === 'string') {
        params = extractArrayParam(elementZero, typeZeroRequired);
      } else {
        const typeZeroTwo = (elementZero as ConduitModel).type;
        const typeZeroTwoRequired = (elementZero as ConduitModel).required;
        params = extractArrayParam(typeZeroTwo!, typeZeroTwoRequired);
      }
    }
  }

  return params;
}
