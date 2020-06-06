import { getCookie } from '../utils/cookie';
import { SET_AUTHENTICATION_TOKEN } from '../redux/actions/actionTypes';

// checks if the page is being loaded on the server, and if so, get auth token from the cookie:
export default function (ctx) {
  if (ctx.isServer) {
    const cookie = getCookie('JWT', ctx.req);

    if (ctx.req.headers.cookie) {
      ctx.store.dispatch({ type: SET_AUTHENTICATION_TOKEN, payload: cookie });
    }
  }
}
