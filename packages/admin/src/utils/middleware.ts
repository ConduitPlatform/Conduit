import { ConduitCommons } from '@quintessential-sft/conduit-commons';

export async function isDev(conduit: ConduitCommons) {
  let isDev = false;
  conduit.getConfigManager().get('core')
    .then((res) => {
      isDev = res.env === 'development';
    });
  return isDev;
}
