export default {
  env: {
    format: 'String',
    default: 'development',
    enum: ['production', 'development', 'test'],
  },
  autoMigration: {
    format: 'Boolean',
    default: true,
  },
};
