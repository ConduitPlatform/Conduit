import {
  GrpcError,
  GrpcRequest,
  GrpcResponse,
  RouterRequest,
  RouterResponse,
} from '../types';
import grpc from 'grpc';

export function wrapCallObjectForRouter(call: any): RouterRequest {
  return {
    request: {
      params: JSON.stringify(call.request),
      path: '',
      headers: '',
      context: '',
    },
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

export function wrapGrpcFunction<T>(
  fun: (call: GrpcRequest<T>) => Promise<any>
): (call: any, callback: any) => void {
  return (call: any, callback: any) => {
    fun(call)
      .then((r) => {
        callback(null, r);
      })
      .catch((error) => {
        callback({
          code: error.code ?? grpc.status.INTERNAL,
          message: error.message ?? 'Something went wrong',
        });
      });
  };
}
