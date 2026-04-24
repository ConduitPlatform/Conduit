import convict from 'convict';

const AppConfigSchema = {
  doc: 'Database module configuration',
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
  viewCleanup: {
    enabled: {
      doc: 'Enable automatic cleanup of stale authorization views',
      format: 'Boolean',
      default: false,
    },
    stalenessThresholdMs: {
      doc: 'Time in milliseconds after which an unused view is considered stale',
      format: 'Number',
      default: 7 * 24 * 60 * 60 * 1000,
    },
    cronPattern: {
      doc: 'Cron pattern for scheduling cleanup. Required when view cleanup is enabled. Example: "0 3 * * *" for daily at 3 AM',
      format: 'String',
      default: '',
    },
    accessUpdateIntervalMs: {
      doc: 'Minimum time in milliseconds between lastAccessedAt updates for the same view (throttle)',
      format: 'Number',
      default: 60 * 60 * 1000,
    },
    batchSize: {
      doc: 'Maximum number of stale views to process per cleanup run. Use 0 for no limit',
      format: 'Number',
      default: 0,
    },
  },
};

const config = convict(AppConfigSchema);
const configProperties = config.getProperties();
export type Config = typeof configProperties;
export default AppConfigSchema;
