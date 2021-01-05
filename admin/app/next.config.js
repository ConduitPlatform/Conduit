const { PHASE_PRODUCTION_BUILD, PHASE_DEVELOPMENT_SERVER } = require('next/constants');

module.exports = (phase) => {
  // when started in development mode `next dev` or `npm run dev`
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  // when `next build` or `npm run build` is used
  const isProd = phase === PHASE_PRODUCTION_BUILD;

  const env = {
    CONDUIT_URL: (() => {
      if (isDev) return 'https://conduit-core.dev.quintessential.gr';
      if (isProd) {
        return process.env.CONDUIT_URL;
      }
      return 'CONDUIT_URL:not (isDev,isProd && isProd)';
    })(),
    MASTER_KEY: (() => {
      if (isDev) return 'M4ST3RK3Y';
      if (isProd) {
        return process.env.MASTER_KEY;
      }
      return 'MASTER_KEY:not (isDev,isProd && isProd)';
    })(),
  };

  return { env };
};
