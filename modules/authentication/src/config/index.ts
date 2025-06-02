import convict from 'convict';
import DefaultConfig from './config.js';
import figmaConfig from './figma.config.js';
import githubConfig from './github.config.js';
import microsoftConfig from './microsoft.config.js';
import googleConfig from './google.config.js';
import facebookConfig from './facebook.config.js';
import twitchConfig from './twitch.config.js';
import slackConfig from './slack.config.js';
import tokenConfig from './token.config.js';
import localConfig from './local.config.js';
import magicLinkConfig from './magicLink.config.js';
import gitlabConfig from './gitlab.config.js';
import redditConfig from './reddit.config.js';
import bitbucketConfig from './bitbucket.config.js';
import linkedInConfig from './linkedIn.config.js';
import appleConfig from './apple.config.js';
import twitterConfig from './twitter.config.js';
import teamsConfig from './teams.config.js';
import metamaskConfig from './metamask.config.js';

const AppConfigSchema = {
  ...DefaultConfig,
  ...teamsConfig,
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
  ...appleConfig,
  ...twitterConfig,
  ...redditConfig,
  ...bitbucketConfig,
  ...linkedInConfig,
  ...metamaskConfig,
};
const config = convict(AppConfigSchema);
const configProperties = config.getProperties();
export type Config = typeof configProperties;
export default AppConfigSchema;
