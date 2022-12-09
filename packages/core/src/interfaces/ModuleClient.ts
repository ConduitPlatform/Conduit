import { ModuleActivationStatus, MigrationStatus } from '@conduitplatform/grpc-sdk';

type ActivateModule = () => Promise<{ status: ModuleActivationStatus }>;
type SetConfig = (config: { newConfig: string }) => Promise<{ updatedConfig: string }>;
type RunMigrations = (params: {
  from: string;
  to: string;
}) => Promise<{ migrationStatus: MigrationStatus }>;

export type ModuleClient = {
  activateModule: ActivateModule;
  setConfig: SetConfig;
  runMigrations: RunMigrations;
};
