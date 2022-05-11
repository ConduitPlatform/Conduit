import convict from 'convict';
import AppConfigSchema from './config';

const configProperties = convict(AppConfigSchema).getProperties();
export type Config = typeof configProperties;
export default convict(AppConfigSchema);
