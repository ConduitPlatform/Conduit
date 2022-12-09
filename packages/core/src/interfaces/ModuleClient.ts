import { ModuleActivationStatus, MigrationStatus } from '@conduitplatform/grpc-sdk';

type ActivateModule = () => Promise<{ status: ModuleActivationStatus }>;
type SetConfig = (config: { newConfig: string }) => Promise<{ updatedConfig: string }>;
type RunMigrations = (params: {
  v1: number;
  v2: number;
  upgrade: boolean;
}) => Promise<{ migrationStatus: MigrationStatus }>;

export type ModuleClient = {
  activateModule: ActivateModule;
  setConfig: SetConfig;
  runMigrations: RunMigrations;
};
