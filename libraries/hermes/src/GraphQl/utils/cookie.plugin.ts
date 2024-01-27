import { Cookie } from '../../interfaces/index.js';

module.exports = {
  requestDidStart() {
    return {
      willSendResponse(requestContext: any) {
        const { setCookie, removeCookie } = requestContext.contextValue;
        const { res } = requestContext.contextValue;

        setCookie.forEach((cookie: Cookie) => {
          if (cookie.options!.path === '') {
            delete cookie.options.path;
          }
          if (!cookie.options.domain || cookie.options.domain === '') {
            delete cookie.options.domain;
          }
          res.cookie(cookie.name, cookie.value, cookie.options);
        });

        if (removeCookie) {
          removeCookie.forEach((cookie: Cookie) => {
            if (cookie.options!.path === '') {
              delete cookie.options.path;
            }
            if (!cookie.options.domain || cookie.options.domain === '') {
              delete cookie.options.domain;
            }
            res.clearCookie(cookie.name, cookie.options);
          });
        }
        return requestContext;
      },
    };
  },
};
