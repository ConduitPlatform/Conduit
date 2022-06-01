export function generateUniqueCollectionName(collectionName: string, length = 6) {
  const validCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let idSuffix = '';
  for (let i = 0; i < length; i++) {
    idSuffix += validCharacters.charAt(Math.floor(Math.random() * validCharacters.length));
  }
  return `${collectionName}_${idSuffix}`;
}
