import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  shims: true,
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.esm.js',
    };
  },
  esbuildOptions(options, context) {
    if (context.format === 'cjs') {
      options.alias = {
        'lodash-es': 'lodash',
      };
    }
  },
  onSuccess: 'copyfiles -u 1 src/*.proto src/**/*.json ./dist/',
});
