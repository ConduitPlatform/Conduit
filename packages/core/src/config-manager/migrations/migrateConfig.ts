import { Config } from '../models';
import { isNil } from 'lodash';

export async function migrateConfig() {
  const config: any[] | null = await Config.getInstance().findMany({});
  if (isNil(config) || config.length === 0) return;
  if (config.length > 1) return;
  if (isNil(config[0].moduleConfigs)) {
    await Config.getInstance().deleteOne({ _id: config[0]._id });
    return;
  }
  const id = config[0]._id;
  for (const [moduleName, newConfig] of Object.entries(config[0].moduleConfigs)) {
    await Config.getInstance().create({ name: moduleName, config: newConfig });
  }
  await Config.getInstance().deleteOne({ _id: id });
}
