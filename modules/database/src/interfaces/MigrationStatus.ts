export enum MigrationStatus {
  SKIPPED = 'SKIPPED', // doesn't need to be executed
  REQUIRED = 'REQUIRED', // needs to be executed
  PENDING = 'PENDING', // needs to be executed manually
  SUCCESSFUL_UP = 'SUCCESSFUL_UP', // execution of up function successful
  SUCCESSFUL_DOWN = 'SUCCESSFUL_DOWN', // execution of down function successful
  FAILED = 'FAILED',
}
