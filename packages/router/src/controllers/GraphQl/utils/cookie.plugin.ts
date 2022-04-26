const cookie = require('cookie');

module.exports = {
  requestDidStart() {
    return {
      willSendResponse(requestContext: any) {

        const { setCookie, removeCookie } = requestContext.context;
        const { res } = requestContext.context;

        Object.keys(setCookie).forEach((cookie) => {
          res.cookie(cookie, setCookie[cookie]);
        });

        if (removeCookie) {
          removeCookie.split(',').forEach((cookie: string) => {
            res.clearCookie(cookie);
          });
        }
        return requestContext;
      },

    };
  },
};