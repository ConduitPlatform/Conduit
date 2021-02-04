module.exports = {
  apps: [
    {
      name: "Core",
      script: "./packages/core/dist/bin/www.js",
    },
    {
      name: "Database-provider",
      script: "./modules/database-provider/dist/index.js",
      env: {
        CONDUIT_SERVER: "0.0.0.0:55152",
        databaseURL:
          "***REMOVED***",
        SERVICE_URL: "0.0.0.0:55153",
        REGISTER_NAME: false,
      },
    },
    // {
    //   name: "Storage-provider",
    //   script: "./modules/storage/dist/index.js",
    //   env: {
    //     CONDUIT_SERVER: "0.0.0.0:55152",
    //     SERVICE_URL: "0.0.0.0:55154",
    //     REGISTER_NAME: false,
    //   },
    // },
    {
      name: "email-provider",
      script: "./modules/email/dist/index.js",
      env: {
        CONDUIT_SERVER: "0.0.0.0:55152",
        SERVICE_URL: "0.0.0.0:55155",
        REGISTER_NAME: false,
      },
    },
    // {
    //   name: "in-memory-provider",
    //   script: "./modules/in-memory-store/dist/index.js",
    //   env: {
    //     CONDUIT_SERVER: "0.0.0.0:55152",
    //     SERVICE_URL: "0.0.0.0:55156",
    //     REGISTER_NAME: false,
    //   },
    // },
    // {
    //   name: "push-provider",
    //   script: "./modules/push-notifications/dist/index.js",
    //   env: {
    //     CONDUIT_SERVER: "0.0.0.0:55152",
    //     SERVICE_URL: "0.0.0.0:55157",
    //     REGISTER_NAME: false,
    //   },
    // },
    {
      name: "cms-provider",
      script: "./modules/cms/dist/index.js",
      env: {
        CONDUIT_SERVER: "0.0.0.0:55152",
        SERVICE_URL: "0.0.0.0:55158",
        REGISTER_NAME: false,
      },
    },
    {
      name: "auth-provider",
      script: "./modules/authentication/dist/index.js",
      env: {
        CONDUIT_SERVER: "0.0.0.0:55152",
        SERVICE_URL: "0.0.0.0:55159",
        REGISTER_NAME: false,
      },
    },
    {
      name: "sms-provider",
      script: "./modules/sms/dist/index.js",
      env: {
        CONDUIT_SERVER: "0.0.0.0:55152",
        SERVICE_URL: "0.0.0.0:55160",
        REGISTER_NAME: false,
      },
    },
    {
      name: "payments-provider",
      script: "./modules/payments/dist/index.js",
      env: {
        CONDUIT_SERVER: "0.0.0.0:55152",
        SERVICE_URL: "0.0.0.0:55161",
        REGISTER_NAME: false,
      },
    }
  ],
};
