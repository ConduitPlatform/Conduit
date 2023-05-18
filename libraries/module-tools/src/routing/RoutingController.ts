import { GrpcCallback, GrpcRequest } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

export class RoutingController {
  private _routeHandlers: {
    [key: string]: (call: any, callback: any) => void;
  } = {};

  handleRequest(call: GrpcRequest<any>, callback: GrpcCallback<any>) {
    if (this._routeHandlers[call.request.functionName]) {
      this._routeHandlers[call.request.functionName](call, callback);
    } else {
      callback({
        code: status.NOT_FOUND,
        message: 'Not found',
      });
    }
  }

  setRoutes(routes: { [key: string]: (call: any, callback: any) => void }) {
    this._routeHandlers = routes;
  }
}
