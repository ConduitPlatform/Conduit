import { Cookie } from '../../interfaces';

module.exports = {
  requestDidStart() {
    return {
      willSendResponse(requestContext: any) {
        const { setCookie, removeCookie } = requestContext.context;
        const { res } = requestContext.context;

        setCookie.forEach((cookie: Cookie) => {
          if (cookie.options!.path === '') {
            delete cookie.options.path;
          }
          if (!cookie.options.domain || cookie.options.domain === '') {
            cookie.options.domain = requestContext.context.req.hostname;
          }
          res.cookie(cookie.name, cookie.value, cookie.options);
        });

        if (removeCookie) {
          removeCookie.forEach((cookie: Cookie) => {
            res.clearCookie(cookie.name, cookie.options);
          });
        }
        return requestContext;
      },
    };
  },
};
