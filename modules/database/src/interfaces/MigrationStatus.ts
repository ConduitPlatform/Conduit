export enum MigrationStatus {
  SKIPPED = 'SKIPPED', // doesn't need to be executed
  REQUIRED = 'REQUIRED', // needs to be executed
  PENDING = 'PENDING', // needs to be executes manually
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
}
