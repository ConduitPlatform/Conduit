import React, { ReactElement, ReactNode, useEffect } from 'react';
import { ThemeProvider } from '@material-ui/core/styles';
import CssBaseline from '@material-ui/core/CssBaseline';
import type { AppContext, AppProps } from 'next/app';
import { Provider } from 'react-redux';
import Head from 'next/head';
import { initializeStore, useStore } from '../redux/store';
import { Layout } from '../components/navigation/Layout';
import { setUpNotifications } from 'reapop';
import { setToken } from '../redux/slices/appAuthSlice';
import App from 'next/app';
import { getCookie } from '../utils/cookie';
import { NextPage } from 'next';
import theme from '../theme';

setUpNotifications({
  defaultProps: {
    position: 'bottom-right',
    dismissible: true,
  },
});

type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

const ConduitApp = ({ Component, pageProps }: AppPropsWithLayout) => {
  const reduxStore = useStore(pageProps.initialReduxState);

  useEffect(() => {
    const jssStyles = document.querySelector('#jss-server-side');
    if (jssStyles && jssStyles.parentElement) {
      jssStyles.parentElement.removeChild(jssStyles);
    }
  }, []);

  const getLayout = Component.getLayout || ((page: any) => page);

  return (
    <>
      <Head>
        <title>Conduit - App</title>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;1,100&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Provider store={reduxStore}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Layout>{getLayout(<Component {...pageProps} />)}</Layout>
        </ThemeProvider>
      </Provider>
    </>
  );
};

ConduitApp.getInitialProps = async (appContext: AppContext) => {
  // calls page's `getInitialProps` and fills `appProps.pageProps`
  const appProps = await App.getInitialProps(appContext);
  const ctx = appContext.ctx;
  //initialize redux store on server side
  const reduxStore = initializeStore({});
  const { dispatch } = reduxStore;

  const cookie = getCookie('JWT', ctx.req);

  setUpNotifications({
    defaultProps: {
      position: 'bottom-right',
      dismissible: true,
    },
  });

  if (
    typeof window === 'undefined' &&
    appContext &&
    appContext.ctx &&
    appContext.ctx.res &&
    appContext.ctx.res.writeHead
  ) {
    if (!cookie && ctx.pathname !== '/login') {
      appContext.ctx.res.writeHead(302, { Location: '/login' });
      appContext.ctx.res.end();
    }
  }

  //if user is already logged in and auth-token cookie exist, add it to redux auth-state
  dispatch(setToken({ token: cookie }));

  appProps.pageProps = {
    ...appProps.pageProps,
    cookie,
    initialReduxState: reduxStore.getState(),
  };

  return appProps;
};

export default ConduitApp;
