import Head from 'next/head';
import React from 'react';
import { Layout } from '../components/Layout';
import { privateRoute } from '../components/utils/privateRoute';
import Typography from '@material-ui/core/Typography';
import Slide from '@material-ui/core/Slide';
import Box from '@material-ui/core/Box';

const Home = () => (
  <>
    <Head>
      <title>Conduit - App</title>
      <link rel="icon" href="/favicon.ico" />
    </Head>

    <Layout itemSelected={0}>
      <Box p={2} display={'flex'} alignItems={'center'} flex={1}>
        <Typography variant={'h1'} style={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
          Welcome to C
          <Slide timeout={2000} in direction={'up'}>
            <Typography variant={'h1'} component={'span'} role="img" aria-label="okhand">
              👌
            </Typography>
          </Slide>
          nduit!
        </Typography>
      </Box>
    </Layout>
  </>
);

export default privateRoute(Home);
