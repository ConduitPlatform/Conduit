import { oauth2Schema } from '../constants/index.js';

const appleOAuthClientSchema = {
  id: {
    doc: 'Unique identifier for this Apple OAuth client credential set (required, must be non-empty and unique)',
    format: 'String',
    default: '',
  },
  name: {
    doc: 'Display name for this Apple OAuth client credential set',
    format: 'String',
    default: '',
    optional: true,
  },
  clientId: {
    doc: 'Apple Services ID for this client (required, must be non-empty)',
    format: 'String',
    default: '',
  },
  privateKey: {
    doc: 'The private key for this Apple OAuth client. Empty string to inherit from top-level Apple. To use a second Apple team, all three of privateKey, teamId, and keyId must be set.',
    format: 'String',
    default: '',
  },
  teamId: {
    doc: 'The team id for this Apple OAuth client. Empty string to inherit from top-level Apple. To use a second Apple team, all three of privateKey, teamId, and keyId must be set.',
    format: 'String',
    default: '',
  },
  keyId: {
    doc: 'The private key id for this Apple OAuth client. Empty string to inherit from top-level Apple. To use a second Apple team, all three of privateKey, teamId, and keyId must be set.',
    format: 'String',
    default: '',
  },
  redirect_uri: {
    doc: 'Redirect URI for this client (defaults to top-level apple.redirect_uri if omitted or empty)',
    format: 'String',
    default: '',
    optional: true,
  },
};

export default {
  apple: {
    ...oauth2Schema,
    clients: {
      doc: 'Additional Apple OAuth client credential sets for multi-app support. Each entry must have a unique non-empty id and non-empty clientId. Credentials (privateKey, teamId, keyId) can be inherited from top-level Apple (omit or set all three to empty string) or provided for a second Apple team (all three must be set). Mixed credentials are rejected.',
      format: 'Array',
      default: [],
      children: appleOAuthClientSchema,
    },
    privateKey: {
      doc: 'The private key that is provided by apple developer console for a specific app',
      format: 'String',
      default: '',
    },
    teamId: {
      doc: 'The team id that is provided by apple developer console for a specific app',
      format: 'String',
      default: '',
    },
    keyId: {
      doc: 'The private key id that is provided by apple developer console for a specific app',
      format: 'String',
      default: '',
    },
  },
};
