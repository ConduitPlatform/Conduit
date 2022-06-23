import { ConduitCommons } from '@conduitplatform/commons';

export async function isDev(conduit: ConduitCommons) {
  // TODO: Optimize me
  return conduit
    .getConfigManager()
    .get('core')
    .then(res => {
      return res.env === 'development';
    });
}
