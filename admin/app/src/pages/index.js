import Head from 'next/head';
import React, { useEffect } from 'react';
import { Layout } from '../components/navigation/Layout';
import { privateRoute } from '../components/utils/privateRoute';
import Typography from '@material-ui/core/Typography';
import Slide from '@material-ui/core/Slide';
import Box from '@material-ui/core/Box';
import { getAdminModules } from '../redux/thunks/appAuthThunks';
import { useDispatch } from 'react-redux';

const Home = () => {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(getAdminModules());
  }, [dispatch]);

  return (
    <>
      <Head>
        <title>Conduit - App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout itemSelected={0}>
        <Box p={2} display={'flex'} alignItems={'center'} flex={1}>
          <Typography
            variant={'h1'}
            style={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
            Welcome to C
            <Slide timeout={2000} in direction={'up'}>
              <Typography
                variant={'h1'}
                component={'span'}
                role="img"
                aria-label="okhand">
                👌
              </Typography>
            </Slide>
            nduit!
          </Typography>
        </Box>
      </Layout>
    </>
  );
};

export default privateRoute(Home);
