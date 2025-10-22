export async function isDev(configManager: any) {
  // TODO: Optimize me
  return configManager.get('core').then((res: any) => {
    return res.env === 'development';
  });
}
