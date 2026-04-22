const AppConfigSchema = {
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
};

export default AppConfigSchema;
