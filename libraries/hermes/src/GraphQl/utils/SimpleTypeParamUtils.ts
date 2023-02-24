import { ConduitRouteOptionExtended, Indexable } from '@conduitplatform/grpc-sdk';

const GQL_PRIMITIVES = ['Number', 'Boolean', 'Date', 'String'];

function extractParam(param: string, required: boolean = false) {
  if (param === 'ObjectId') {
    return 'ID' + (required ? '!' : '');
  } else if (param === 'JSON') {
    return 'JSONObject' + (required ? '!' : '');
  } else {
    return param + (required ? '!' : '');
  }
}

function extractArrayParam(
  param: string,
  required: boolean = false,
  originalParam?: any,
) {
  if (GQL_PRIMITIVES.indexOf(param) !== -1) {
    return `[${param}]` + (required ? '!' : '');
  } else if (param === 'ObjectId') {
    return '[ID]' + (required ? '!' : '');
  } else if (param === 'JSON') {
    return '[JSONObject]' + (required ? '!' : '');
  } else {
    return `[${originalParam ?? param}]` + (required ? '!' : '');
  }
}

export function processParams(paramObj: Indexable, sourceParams: string) {
  let params = sourceParams;

  for (const k in paramObj) {
    if (!paramObj.hasOwnProperty(k)) continue;
    params += (params.length > 1 ? ',' : '') + k + ':';
    if (typeof paramObj[k] === 'string') {
      params += extractParam(paramObj[k]);
    } else if (Array.isArray(paramObj[k])) {
      const elementZero = paramObj[k][0];
      if (typeof elementZero === 'string') {
        params += extractArrayParam(elementZero, false, paramObj[k]);
      } else {
        const typeZero = (elementZero as ConduitRouteOptionExtended).type;
        const typeZeroRequired = (elementZero as ConduitRouteOptionExtended).required;
        params += extractArrayParam(typeZero, typeZeroRequired);
      }
    } else {
      const typeZero = (paramObj[k] as ConduitRouteOptionExtended).type;
      const typeZeroRequired = (paramObj[k] as ConduitRouteOptionExtended).required;
      if (typeof typeZero === 'string') {
        params += extractParam(typeZero, typeZeroRequired);
      } else if (Array.isArray(typeZero)) {
        const elementZero = typeZero[0];
        if (typeof elementZero === 'string') {
          params += extractArrayParam(elementZero, typeZeroRequired, typeZero);
        } else {
          const typeZeroTwo = (elementZero as ConduitRouteOptionExtended).type;
          const typeZeroTwoRequired = (elementZero as ConduitRouteOptionExtended)
            .required;
          params += extractArrayParam(typeZeroTwo, typeZeroTwoRequired);
        }
      }
    }
  }
  return params;
}
