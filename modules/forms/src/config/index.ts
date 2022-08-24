import convict from 'convict';
import AppConfigSchema from './config';

const config = convict(AppConfigSchema);
const configProperties = config.getProperties();
export type Config = typeof configProperties;
export default AppConfigSchema;
