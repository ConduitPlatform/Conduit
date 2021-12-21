import { _DeclaredSchema } from '../models';

export async function migrateModelOptions() {
  const documents = await _DeclaredSchema.getInstance()
    .findMany({ 'modelOptions.conduit': { $exists: false } })
    .catch((e: Error) => { Promise.reject(e.message); });

  for (const schema of (documents as _DeclaredSchema[])) {
    let newModelOptions: any = { conduit: {} };
    try { // modelOptions could be {}
      newModelOptions = { ...newModelOptions, ...JSON.parse((schema.modelOptions as unknown as string)) };
    } catch {
      newModelOptions = { ...newModelOptions, ...schema.modelOptions };
    }
    await _DeclaredSchema.getInstance().findByIdAndUpdate(schema._id, {
      modelOptions: newModelOptions,
    }).catch((err: Error) => {
      console.log(err);
    });
  }
}
