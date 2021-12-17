import { _DeclaredSchema } from '../models/DeclaredSchema.schema';
import { isNil } from 'lodash';

export async function migrateModelOptions() {
  let errorMessage: string | null = null;
  const documents: any = await _DeclaredSchema.getInstance().findMany({})
    .catch((e: Error) => (errorMessage = e.message));
  if (!isNil(errorMessage)) {
    return Promise.reject(errorMessage);
  }
  for (const schema of documents) {
    if (typeof schema.modelOptions !== 'string') continue;
    const newModelOptions = JSON.parse(schema.modelOptions);
    await _DeclaredSchema.getInstance().findByIdAndUpdate(schema._id, {
      modelOptions: newModelOptions,
    }).catch((err: Error) => {
      console.log(err);
    });
  }
}