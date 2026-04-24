import convict from 'convict';

const AppConfigSchema = {
  readPreference: {
    doc: 'MongoDB read preference for query routing',
    format: 'String',
    default: 'primary',
    enum: ['primary', 'primaryPreferred', 'secondary', 'secondaryPreferred', 'nearest'],
  },
  writeConcern: {
    doc: 'MongoDB write concern level',
    format: 'String',
    default: '1',
    enum: ['1', 'majority'],
  },
  readConcern: {
    doc: 'MongoDB read concern level',
    format: 'String',
    default: 'local',
    enum: ['local', 'available', 'majority', 'linearizable', 'snapshot'],
  },
};

const config = convict(AppConfigSchema);
const configProperties = config.getProperties();
export type Config = typeof configProperties;
export default AppConfigSchema;
