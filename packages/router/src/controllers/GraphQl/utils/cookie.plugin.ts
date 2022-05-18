import { Cookie } from '../../interfaces/Cookie';

module.exports = {
  requestDidStart() {
    return {
      willSendResponse(requestContext: any) {

        const { setCookie, removeCookie } = requestContext.context;
        const { res } = requestContext.context;

        setCookie.forEach((cookie: Cookie) => {
          if (cookie.options!.path === '') {
            // @ts-ignore
            delete cookie.options.path;
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