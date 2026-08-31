import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';
import { createServiceTsupConfig } from '@conduitplatform/service-bundle/tsup';
import bundleConfig from './service-bundle.config.json' with { type: 'json' };

const root = path.dirname(fileURLToPath(import.meta.url));

// Bundle node-2fa from TS source (dist CJS breaks ESM shims); notp/thirty-two/qrcode stay external.
const extraExternal = [...bundleConfig.extraDependencies, 'notp', 'thirty-two', 'qrcode'];

const base = createServiceTsupConfig({ extraExternal });

export default defineConfig({
  ...base,
  esbuildOptions(esbuildOptions) {
    base.esbuildOptions?.(esbuildOptions);
    esbuildOptions.alias = {
      ...esbuildOptions.alias,
      '@conduitplatform/node-2fa': path.resolve(
        root,
        '../../libraries/node-2fa/src/index.ts',
      ),
    };
  },
});
