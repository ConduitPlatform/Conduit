import Cookies from 'js-cookie';

export const setCookie = (key: string, value: string, remember: boolean) => {
  if (typeof window !== 'undefined') {
    if (remember) {
      const sixHours = new Date(new Date().getTime() + 6 * 60 * 60 * 1000);

      Cookies.set(key, value, {
        expires: sixHours,
      });
    } else {
      Cookies.set(key, value);
    }
  }
};
export const removeCookie = (key: string) => {
  if (typeof window !== 'undefined') {
    Cookies.remove(key, {
      expires: 1,
    });
  }
};

const getCookieFromBrowser = (key: string) => {
  return Cookies.get(key);
};

const getCookieFromServer = (key: string, req: any) => {
  if (!req.headers.cookie) {
    return undefined;
  }
  const rawCookie = req.headers.cookie
    .split(';')
    .find((c: string) => c.trim().startsWith(`${key}=`));
  if (!rawCookie) {
    return undefined;
  }
  return rawCookie.split('=')[1];
};

export const getCookie = (key: string, req: any) => {
  return typeof window !== 'undefined' ? getCookieFromBrowser(key) : getCookieFromServer(key, req);
};
