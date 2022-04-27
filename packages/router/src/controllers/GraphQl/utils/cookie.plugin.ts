module.exports = {
  requestDidStart() {
    return {
      willSendResponse(requestContext: any) {

        const { setCookie, removeCookie } = requestContext.context;
        const { res } = requestContext.context;

        setCookie.forEach((cookie: any) => {
          res.cookie(cookie.name, cookie.value, cookie.options);
        });

        if (removeCookie) {
          removeCookie.forEach((cookie: any) => {
            res.clearCookie(cookie.name, { domain: cookie.options.domain, path: cookie.options.path });
          });
        }
        return requestContext;
      },

    };
  },
};