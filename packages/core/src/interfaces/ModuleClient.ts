import { ModuleActivationStatus } from '@conduitplatform/grpc-sdk';

type ActivateModule = () => Promise<{ status: ModuleActivationStatus }>;
type SetConfig = (config: { newConfig: string }) => Promise<{ updatedConfig: string }>;

export type ModuleClient = {
  activateModule: ActivateModule;
  setConfig: SetConfig;
};
