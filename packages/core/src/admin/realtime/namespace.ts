export function adminSocketNamespace(moduleName: string | undefined | null): string {
  const name = typeof moduleName === 'string' ? moduleName.trim() : '';
  if (!name) {
    throw new Error('module-name metadata is required for Admin socket push');
  }
  return `/${name}/`;
}
