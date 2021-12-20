import { _DeclaredSchema } from '../models/DeclaredSchema.schema';

export async function migrateModelOptions() {
  const documents = await _DeclaredSchema.getInstance()
    .findMany({ modelOptions: { $type: 'string' } })
    .catch((e: Error) => { Promise.reject(e.message); });

  for (const schema of (documents as _DeclaredSchema[])) {
    const newModelOptions = JSON.parse((schema.modelOptions as string));
    await _DeclaredSchema.getInstance().findByIdAndUpdate(schema._id, {
      modelOptions: newModelOptions,
    }).catch((err: Error) => {
      console.log(err);
    });
  }
}