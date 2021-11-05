const { PHASE_PRODUCTION_BUILD } = require('next/constants');
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

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
    IS_DEV: isDev,
    IS_PROD: isProd,
  };

  const publicRuntimeConfig = {
    // Will only be available on the server side
    CONDUIT_URL: process.env.CONDUIT_URL,
    MASTER_KEY: process.env.MASTER_KEY,
  };

  const redirects = async () => {
    return [
      {
        source: '/authentication',
        destination: '/authentication/users',
        permanent: true,
      },
      {
        source: '/emails',
        destination: '/emails/templates',
        permanent: true,
      },
      {
        source: '/cms',
        destination: '/cms/schemas',
        permanent: true,
      },
      {
        source: '/storage',
        destination: '/storage/files',
        permanent: true,
      },
      {
        source: '/settings',
        destination: '/settings/clientsdk',
        permanent: true,
      },
      {
        source: '/push-notifications',
        destination: '/push-notifications/send',
        permanent: true,
      },
      {
        source: '/forms',
        destination: '/forms/view',
        permanent: true,
      },
      {
        source: '/sms',
        destination: '/sms/send',
        permanent: true,
      },
      {
        source: '/payments',
        destination: '/payments/customers',
        permanent: true,
      },
    ];
  };

  const eslint = {
    ignoreDuringBuilds: false,
  };

  return { env, publicRuntimeConfig, redirects, eslint };
};
