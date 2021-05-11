import { RouterRequest, RouterResponse } from '../types';

export function wrapCallObjectForRouter(call: any): RouterRequest {
  return {
    request: {
      params: JSON.stringify(call.request),
      path: '',
      headers: '',
      context: ''
    }
  };
}

export function wrapCallbackFunctionForRouter(callback: any): RouterResponse {
  return (err, res) => {
    if (err || !res) {
      return callback(err);
    }

    if (res.hasOwnProperty('result')) {
      // @ts-ignore
      return callback(null, JSON.parse(res.result));
    }

    callback(null, null);
  };
}
