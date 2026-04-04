import { ConduitModel, ConduitValidationRules, TYPE } from '@conduitplatform/grpc-sdk';

export function applyOpenApiFieldValidation(
  res: Record<string, unknown>,
  validate?: ConduitValidationRules,
): void {
  if (!validate || typeof validate !== 'object') return;
  const v = validate as Record<string, unknown>;
  if (v.format === 'email') res.format = 'email';
  if (v.format === 'url') res.format = 'uri';
  if (v.format === 'uuid') res.format = 'uuid';
  if (v.minLength != null) res.minLength = v.minLength;
  if (v.maxLength != null) res.maxLength = v.maxLength;
  if (v.pattern) res.pattern = v.pattern;
  if (v.min != null) res.minimum = v.min;
  if (v.max != null) res.maximum = v.max;
  if (v.exclusiveMin != null) res.exclusiveMinimum = v.exclusiveMin;
  if (v.exclusiveMax != null) res.exclusiveMaximum = v.exclusiveMax;
  if (v.minItems != null) res.minItems = v.minItems;
  if (v.maxItems != null) res.maxItems = v.maxItems;
}

function extractParam(
  param: string,
  required: boolean = false,
  validate?: ConduitValidationRules,
) {
  const res: Record<string, unknown> = { type: 'string' };
  switch (param) {
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
      break;
    case 'String':
    case 'Number':
    case 'Boolean':
      res.type = param.toLowerCase();
      break;
  }
  applyOpenApiFieldValidation(res, validate);
  return res;
}

function extractArrayParam(
  param: string,
  required: boolean = false,
  validate?: ConduitValidationRules,
) {
  const items = extractParam(param, required);
  const res: Record<string, unknown> = {
    type: 'array',
    items,
    minItems: required ? 1 : 0,
  };
  applyOpenApiFieldValidation(res, validate);
  return res;
}

export function processSwaggerParams(paramObj: any) {
  let params: Record<string, unknown> = {};

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
      const itemValidate = (elementZero as { validate?: ConduitValidationRules })
        .validate;
      params = {
        type: 'array',
        items: {
          ...extractParam(typeZero! as string, typeZeroRequired, itemValidate),
        },
        minItems: typeZeroRequired ? 1 : 0,
      };
    }
  } else {
    const typeZero = (paramObj as ConduitModel).type;
    const typeZeroRequired = (paramObj as ConduitModel).required;
    const validate = (paramObj as { validate?: ConduitValidationRules }).validate;
    if (typeof typeZero === 'string') {
      params = extractParam(typeZero, typeZeroRequired, validate);
    } else if (Array.isArray(typeZero)) {
      const elementZero = typeZero[0];
      if (typeof elementZero === 'string') {
        params = extractArrayParam(elementZero, typeZeroRequired, validate);
      } else {
        const typeZeroTwo = (elementZero as ConduitModel).type;
        const typeZeroTwoRequired = (elementZero as ConduitModel).required;
        const itemValidate = (elementZero as { validate?: ConduitValidationRules })
          .validate;
        params = {
          type: 'array',
          items: {
            ...extractParam(typeZeroTwo! as string, typeZeroTwoRequired, itemValidate),
          },
          minItems: typeZeroTwoRequired ? 1 : 0,
        };
        applyOpenApiFieldValidation(params, validate);
      }
    }
  }

  return params;
}
