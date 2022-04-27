import { remove } from 'lodash';

const cookie = require('cookie');

module.exports = {
  requestDidStart() {
    return {
      willSendResponse(requestContext: any) {

        const { setCookie, removeCookie, cookieOptions } = requestContext.context;
        const { res } = requestContext.context;

        setCookie.forEach((cookie: any) => {
          res.cookie(cookie.name, cookie.value, cookie.options);
        });

        if (removeCookie) {
          removeCookie.forEach((cookie: string) => {
            res.clearCookie(cookie, { domain: cookieOptions.domain, path: cookieOptions.path });
          });
        }
        return requestContext;
      },

    };
  },
};