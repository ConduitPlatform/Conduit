const AppConfigSchema = {
  doc: 'Database module configuration',
  readPreference: {
    doc: 'MongoDB read preference for query routing',
    format: ['primary', 'primaryPreferred', 'secondary', 'secondaryPreferred', 'nearest'],
    default: 'primary',
  },
  writeConcern: {
    doc: 'MongoDB write concern level',
    format: ['1', 'majority'],
    default: '1',
  },
  readConcern: {
    doc: 'MongoDB read concern level',
    format: ['local', 'available', 'majority', 'linearizable', 'snapshot'],
    default: 'local',
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

export default AppConfigSchema;
