import { createServiceTsupConfig } from '@conduitplatform/service-bundle/tsup';

// axios + lodash-es stay external (shared list) for VM sandbox require-shim
// (see src/sandbox/functionSandbox.ts).
export default createServiceTsupConfig();
