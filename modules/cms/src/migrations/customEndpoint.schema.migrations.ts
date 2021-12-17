import { CustomEndpoints } from '../models';
import { isNil } from 'lodash';

export async function migrateCustomEndpoints() {
  let errorMessage: string | null = null;
  const documents: any = await CustomEndpoints.getInstance().findMany({})
    .catch((e: Error) => (errorMessage = e.message));
  if (!isNil(errorMessage)) {
    return Promise.reject(errorMessage);
  }

  for (const document of documents) {
    if (!isNil(document.queries) && isNil(document.query)) {
      document.query = { AND: document.queries };

      await CustomEndpoints.getInstance().findByIdAndUpdate(document._id, document)
        .catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage)) {
        return Promise.reject(errorMessage);
      }
    }
  }
}
