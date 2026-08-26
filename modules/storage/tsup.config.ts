import { createServiceTsupConfig } from '@conduitplatform/service-bundle/tsup';
import bundleConfig from './service-bundle.config.json' with { type: 'json' };

// Cloud SDKs stay external (CJS/native-sensitive); versions come from package.json + lockfile.
export default createServiceTsupConfig({
  extraExternal: bundleConfig.extraDependencies,
});
