const cookie = require('cookie');

module.exports = {
  requestDidStart() {
    return {
      willSendResponse(requestContext: any) {
        const { setCookieString } = requestContext.context;
        let cookieArray = setCookieString.split(';');
        let cookiesObject: any = [];
        cookieArray.forEach((cookie: string) => {
          cookiesObject.push({
            'Set-Cookie': cookie,
          });
        });
        const map = new Map(cookiesObject);
        requestContext.http.headers = map;
        return requestContext;
      },

    };
  },
};