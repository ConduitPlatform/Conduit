import { createServiceTsupConfig } from '@conduitplatform/service-bundle/tsup';
import bundleConfig from './service-bundle.config.json' with { type: 'json' };

export default createServiceTsupConfig({
  extraExternal: bundleConfig.extraDependencies,
});
