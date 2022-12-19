export * from './linearBackoffTimeout';
export * from './registerMigrations';

export function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
