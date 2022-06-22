import { ConduitCommons } from '@conduitplatform/commons';

export async function isDev(conduit: ConduitCommons) {
  return conduit
    .getConfigManager()
    .get('core')
    .then(res => {
      return res.env === 'development';
    });
}
