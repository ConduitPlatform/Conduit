export enum MigrationStatus {
  SKIPPED = 'SKIPPED', // doesn't need to be executed
  REQUIRED = 'REQUIRED', // needs to be executed
  PENDING = 'PENDING', // needs to be executed manually
  SUCCESSFUL_AUTO_UP = 'SUCCESSFUL_AUTO_UP', // automatic execution of up function successful
  SUCCESSFUL_MANUAL_UP = 'SUCCESSFUL_MANUAL_UP', // manual execution of up function successful
  SUCCESSFUL_MANUAL_DOWN = 'SUCCESSFUL_MANUAL_DOWN', // manual execution of down function successful
  FAILED = 'FAILED',
}
