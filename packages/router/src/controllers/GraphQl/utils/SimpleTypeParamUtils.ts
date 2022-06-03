import { ConduitRouteOptionExtended } from '@conduitplatform/grpc-sdk';

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
  if (GQL_PRIMITIVES.indexOf(param)) {
    return `[${param}]` + (required ? '!' : '');
  } else if (param === 'ObjectId') {
    return '[ID]' + (required ? '!' : '');
  } else if (param === 'JSON') {
    return '[JSONObject]' + (required ? '!' : '');
  } else {
    return `[${originalParam ?? param}]` + (required ? '!' : '');
  }
}

export function processParams(paramObj: any, sourceParams: string) {
  let params = sourceParams;

  for (let k in paramObj) {
    if (!paramObj.hasOwnProperty(k)) continue;
    params += (params.length > 1 ? ',' : '') + k + ':';
    if (typeof paramObj[k] === 'string') {
      params += extractParam(paramObj[k]);
    } else if (Array.isArray(paramObj[k])) {
      let elementZero = paramObj[k][0];
      if (typeof elementZero === 'string') {
        params += extractArrayParam(elementZero, false, paramObj[k]);
      } else {
        let typeZero = (elementZero as ConduitRouteOptionExtended).type;
        let typeZeroRequired = (elementZero as ConduitRouteOptionExtended).required;
        params += extractArrayParam(typeZero, typeZeroRequired);
      }
    } else {
      let typeZero = (paramObj[k] as ConduitRouteOptionExtended).type;
      let typeZeroRequired = (paramObj[k] as ConduitRouteOptionExtended).required;
      if (typeof typeZero === 'string') {
        params += extractParam(typeZero, typeZeroRequired);
      } else if (Array.isArray(typeZero)) {
        let elementZero = typeZero[0];
        if (typeof elementZero === 'string') {
          params += extractArrayParam(elementZero, typeZeroRequired, typeZero);
        } else {
          let typeZeroTwo = (elementZero as ConduitRouteOptionExtended).type;
          let typeZeroTwoRequired = (elementZero as ConduitRouteOptionExtended).required;
          params += extractArrayParam(typeZeroTwo, typeZeroTwoRequired);
        }
      }
    }
  }
  return params;
}
