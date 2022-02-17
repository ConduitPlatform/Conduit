// import { GrpcServer } from '..';
import { ManagedModule } from './ManagedModule';
// import path from 'path';
// import fs from 'fs';
// import { snakeCase } from 'lodash';

export class ConfigController {
  private static instance: ConfigController;
  private module: ManagedModule;

  private constructor(module: ManagedModule) {
    this.module = module;
  }

  private _config: any;

  get config() {
    // return copy of config and not the original object;
    return Object.assign({}, this._config);
  }

  set config(config: any) {
    this._config = config;
  }

  static getInstance(module?: ManagedModule): ConfigController {
    if (!ConfigController.instance) {
      if (!module) { throw new Error('ConfigController.getInstance() requires module arg during initialization'); }
      ConfigController.instance = new ConfigController(module);
    }
    return ConfigController.instance;
  }

//   async addConfigService(grpcServer: GrpcServer, moduleName: string) {
//     const { protoPath, protoFile, protoDescription } = ConfigController.constructProtoFile(moduleName);
//     await grpcServer.addService(
//       protoPath,
//       protoDescription,
//       { setConfig: this.module.setConfig }
//     );
//   }
//
//   static constructProtoFile(moduleName: string) {
//     const protoDescription = snakeCase(moduleName) + '.config';
//     const protoFile =
//       `syntax = "proto3";
// package MODULE_NAME.config
//
// service {
//   rpc SetConfig(SetConfigRequest) returns (SetConfigResponse);
// }
//
// message SetConfigRequest {
//   string newConfig = 1;
// }
//
// message SetConfigResponse {
//   string updatedConfig = 1;
// }`
//         .toString()
//         .replace('DESCRIPTION', protoDescription);
//
//     const protoPath = path.resolve(
//       __dirname,
//       `${moduleName}-config-${Math.random().toString(36).substring(7)}.proto`
//     );
//     fs.writeFileSync(protoPath, protoFile);
//     return { protoPath, protoFile, protoDescription };
//   }
}
