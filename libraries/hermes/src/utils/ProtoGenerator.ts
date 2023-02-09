import {
  ConduitProxyObject,
  ConduitRouteObject,
  SocketProtoDescription,
} from '@conduitplatform/grpc-sdk';

type ProtoTemplate = {
  request: string;
  response: string;
  template: string;
};

export class ProtoGenerator {
  private static _instance: ProtoGenerator;
  private constructor(private readonly protoTemplate: ProtoTemplate) {}

  static getInstance(template?: ProtoTemplate) {
    if (ProtoGenerator._instance) return ProtoGenerator._instance;
    if (!template) throw new Error('No proto file template provided!');
    ProtoGenerator._instance = new ProtoGenerator(template);
    return ProtoGenerator._instance;
  }

  generateProtoFile(
    moduleName: string,
    paths: (ConduitRouteObject | SocketProtoDescription | ConduitProxyObject)[],
  ) {
    const formattedModuleName = this.getFormattedModuleName(moduleName);
    const protoFunctions = this.createProtoFunctions(paths);
    let protoFile = this.protoTemplate.template.replace(
      'MODULE_FUNCTIONS',
      protoFunctions,
    );
    protoFile = protoFile.replace('MODULE_NAME', formattedModuleName);
    return { protoFile, formattedModuleName };
  }

  private getFormattedModuleName(moduleName: string) {
    return moduleName.replace('-', '_');
  }

  private createProtoFunctions(
    paths: (ConduitRouteObject | SocketProtoDescription | ConduitProxyObject)[],
  ) {
    let protoFunctions = '';

    paths.forEach(r => {
      if (r.hasOwnProperty('events')) {
        protoFunctions += this.createProtoFunctionsForSocket(
          r as SocketProtoDescription,
          protoFunctions,
        );
      } else {
        protoFunctions += this.createProtoFunctionForRoute(
          r as ConduitRouteObject,
          protoFunctions,
        );
      }
    });

    return protoFunctions;
  }

  private createProtoFunctionsForSocket(
    path: SocketProtoDescription,
    protoFunctions: string,
  ) {
    let newFunctions = '';
    const events = JSON.parse(path.events);
    Object.keys(events).forEach(event => {
      const newFunction = this.createGrpcFunctionName(events[event].grpcFunction);

      if (protoFunctions.indexOf(`rpc ${newFunction}(`) !== -1) {
        return;
      }

      newFunctions += `rpc ${newFunction}(SocketRequest) returns (SocketResponse);\n`;
    });

    return newFunctions;
  }

  private createProtoFunctionForRoute(path: ConduitRouteObject, protoFunctions: string) {
    const newFunction = this.createGrpcFunctionName(path.grpcFunction);

    if (protoFunctions.indexOf(`rpc ${newFunction}(`) !== -1) {
      return '';
    }
    return `rpc ${newFunction}(${this.protoTemplate.request}) returns (${this.protoTemplate.response});\n`;
  }

  private createGrpcFunctionName(grpcFunction: string) {
    return grpcFunction.charAt(0).toUpperCase() + grpcFunction.slice(1);
  }
}
