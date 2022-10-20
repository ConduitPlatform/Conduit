import { Config } from '../models';
import { isNil } from 'lodash';

export async function migrateConfig() {
  const configs: any[] | null = await Config.getInstance().findMany({});
  if (isNil(configs) || configs.length === 0) return;
  if (configs.length > 1) return;
  const id = configs[0]._id;
  for (const [moduleName, newConfig] of Object.entries(configs[0].moduleConfigs)) {
    await Config.getInstance().create({ name: moduleName, config: newConfig });
  }
  await Config.getInstance().deleteOne({ _id: id });
}
