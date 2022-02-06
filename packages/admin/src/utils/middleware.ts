import { ConduitCommons } from '@conduitplatform/conduit-commons';

export async function isDev(conduit: ConduitCommons) {
  let isDev = false;
  conduit.getConfigManager().get('core')
    .then((res) => {
      isDev = res.env === 'development';
    });
  return isDev;
}
