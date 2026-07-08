import { oauth2Schema } from '../constants/index.js';

const appleOAuthClientSchema = {
  id: {
    doc: 'Unique identifier for this Apple OAuth client credential set',
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
    format: 'String',
    default: '',
  },
  privateKey: {
    doc: 'The private key for this Apple OAuth client',
    format: 'String',
    default: '',
  },
  teamId: {
    doc: 'The team id for this Apple OAuth client',
    format: 'String',
    default: '',
  },
  keyId: {
    doc: 'The private key id for this Apple OAuth client',
    format: 'String',
    default: '',
  },
  redirect_uri: {
    format: 'String',
    default: '',
    optional: true,
  },
};

export default {
  apple: {
    ...oauth2Schema,
    clients: {
      doc: 'Additional Apple OAuth client credential sets for multi-app support',
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
