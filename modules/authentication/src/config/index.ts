import convict from 'convict';
import DefaultConfig from './config';
import figmaConfig from './figma.config';
import githubConfig from './github.config';
import microsoftConfig from './microsoft.config';
import googleConfig from './google.config';
import facebookConfig from './facebook.config';
import twitchConfig from './twitch.config';
import slackConfig from './slack.config';
import tokenConfig from './token.config';
import localConfig from './local.config';
import magicLinkConfig from './magicLink.config';
import gitlabConfig from './gitlab.config';
import bitbucketConfig from './bitbucket.config';

const AppConfigSchema = {
  ...DefaultConfig,
  ...figmaConfig,
  ...githubConfig,
  ...microsoftConfig,
  ...googleConfig,
  ...facebookConfig,
  ...twitchConfig,
  ...slackConfig,
  ...tokenConfig,
  ...localConfig,
  ...magicLinkConfig,
  ...gitlabConfig,
  ...bitbucketConfig,
};
const config = convict(AppConfigSchema);
const configProperties = config.getProperties();
export type Config = typeof configProperties;
export default AppConfigSchema;
