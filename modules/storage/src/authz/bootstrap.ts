import { IStorageProvider } from '../interfaces/index.js';
import { _StorageContainer } from '../models/index.js';
import { defaultContainerName } from './helpers.js';

export async function ensureDefaultContainer(
  storageProvider: IStorageProvider,
): Promise<_StorageContainer> {
  const name = defaultContainerName();
  let container = await _StorageContainer.getInstance().findOne({ name });
  if (!container) {
    container = await _StorageContainer.getInstance().create({
      name,
      isPublic: false,
    });
  }

  const exists = await storageProvider.containerExists(name);
  if (exists !== true) {
    await storageProvider.createContainer(name);
  }

  return container;
}
