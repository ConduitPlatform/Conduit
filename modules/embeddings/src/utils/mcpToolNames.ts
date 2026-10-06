export function embeddingsMcpToolName(action: string, publicPath: string): string {
  const cleanPath = publicPath
    .replace(/^\/admin\//, '')
    .replace(/\//g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
  return `${action.toLowerCase()}${cleanPath}`;
}

export function embeddingsPublicPath(
  routePath: string,
  moduleName = 'embeddings',
): string {
  if (
    routePath.startsWith(`/${moduleName}/`) ||
    routePath.startsWith(`/hook/${moduleName}/`)
  ) {
    return routePath;
  }
  return `/${moduleName}${routePath}`;
}
