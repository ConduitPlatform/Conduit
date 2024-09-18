import convict from 'convict';
import emailConfig from './email.js';
import pushConfig from './push.js';
import smsConfig from './sms.js';
import generalConfig from './comms.js';

const AppConfigSchema = {
  ...generalConfig,
  ...emailConfig,
  ...pushConfig,
  ...smsConfig,
};
const config = convict(AppConfigSchema);
const configProperties = config.getProperties();
export type Config = typeof configProperties;
export default AppConfigSchema;
