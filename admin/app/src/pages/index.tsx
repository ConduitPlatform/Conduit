import Head from 'next/head';
import React from 'react';
import Typography from '@material-ui/core/Typography';
import Slide from '@material-ui/core/Slide';
import Box from '@material-ui/core/Box';
import theme from '../theme';

const Home = () => {
  return (
    <>
      <Head>
        <title>Conduit - App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Box p={2} display={'flex'} alignItems={'center'} flex={1}>
        <Typography
          variant={'h1'}
          style={{
            display: 'flex',
            justifyContent: 'center',
            flex: 1,
            color: theme.palette.secondary.main,
          }}>
          Welcome to C
          <Slide timeout={2000} in direction={'up'}>
            <Typography variant={'h1'} component={'span'} role="img" aria-label="okhand">
              👌
            </Typography>
          </Slide>
          nduit!
        </Typography>
      </Box>
    </>
  );
};

export default Home;
