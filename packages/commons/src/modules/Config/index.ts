import { GrpcServer } from '@conduitplatform/grpc-sdk';

export abstract class IConfigManager {
  abstract initialize(server: GrpcServer): Promise<void>;
  abstract initConfigAdminRoutes(): void;
  abstract registerAppConfig(): Promise<any>;
  abstract get(moduleName: string): Promise<any>;
  abstract set(moduleName: string, moduleConfig: any): Promise<any>;
  abstract addFieldsToModule(moduleName: string, moduleConfig: any): Promise<any>;
  abstract getModuleUrlByName(moduleName: string): string | undefined;
  abstract isModuleUp(moduleName: string): Promise<boolean>;
  abstract configurePackage(moduleName: string, config: any, schema: any): Promise<any>;
}
