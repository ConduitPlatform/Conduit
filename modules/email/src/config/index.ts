import convict from 'convict';

import AppConfigSchema from './config';

export default (() => {
  return convict(AppConfigSchema);
})();
