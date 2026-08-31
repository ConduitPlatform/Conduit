import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';
import { createServiceTsupConfig } from '@conduitplatform/service-bundle/tsup';
import bundleConfig from './service-bundle.config.json' with { type: 'json' };

const root = path.dirname(fileURLToPath(import.meta.url));

const base = createServiceTsupConfig({
  entry: { index: 'src/bin/www.ts' },
  extraExternal: [
    '@conduitplatform/hermes',
    '@conduitplatform/grpc-sdk',
    ...(bundleConfig.extraDependencies ?? []),
    'notp',
    'qrcode',
    'thirty-two',
  ],
});

export default defineConfig({
  ...base,
  // Inline module-tools only; hermes + grpc-sdk stay external (shared nested COPY).
  noExternal: [/@conduitplatform\/(?!hermes($|\/)|grpc-sdk($|\/))/],
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
