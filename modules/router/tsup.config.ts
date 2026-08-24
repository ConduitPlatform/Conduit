import { defineConfig } from 'tsup';
import { createServiceTsupConfig } from '@conduitplatform/service-bundle/tsup';
import bundleConfig from './service-bundle.config.json' with { type: 'json' };

const base = createServiceTsupConfig({
  extraExternal: [
    '@conduitplatform/hermes',
    '@conduitplatform/grpc-sdk',
    ...(bundleConfig.extraDependencies ?? []),
  ],
});

export default defineConfig({
  ...base,
  // Inline module-tools only; hermes + grpc-sdk stay external (shared nested COPY).
  // Inlining grpc-sdk while hermes stays external splits ConduitGrpcSdk.Logger —
  // hermes then sees undefined winston and express-winston throws.
  noExternal: [/@conduitplatform\/(?!hermes($|\/)|grpc-sdk($|\/))/],
});
