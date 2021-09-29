import Head from 'next/head';
import React from 'react';
import Typography from '@material-ui/core/Typography';
import Slide from '@material-ui/core/Slide';
import Box from '@material-ui/core/Box';
import {
  Container,
  createStyles,
  Grid,
  makeStyles,
  Paper,
  Theme,
} from '@material-ui/core';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    paper: {
      height: 100,
      width: 260,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.primary.main,
      color: '#fff',
      '&:hover': {
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: theme.palette.secondary.main,
      },
      '&:focus': {
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: theme.palette.secondary.main,
      },
    },
  })
);

const Home = () => {
  const classes = useStyles();
  return (
    <>
      <Head>
        <title>Conduit - App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        alignSelf="center"
        marginTop="300px">
        <Grid container justify="center" alignItems="center" spacing={3}>
          <Grid item xs={4}>
            <Paper className={classes.paper} variant="elevation">
              <Typography>set up emails</Typography>
            </Paper>
          </Grid>
          <Grid item xs={4}>
            <Paper className={classes.paper} variant="elevation">
              <Typography align="center">choose Provider</Typography>
            </Paper>
          </Grid>
          <Grid item xs={4}>
            <Paper className={classes.paper} variant="elevation">
              <Typography>manage your schemas</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </>
  );
};

export default Home;

{
  /* <Box p={2} display={'flex'} alignItems={'center'} flex={1}>
<Typography
  variant={'h1'}
  style={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
  Welcome to C
  <Slide timeout={2000} in direction={'up'}>
    <Typography variant={'h1'} component={'span'} role="img" aria-label="okhand">
      👌
    </Typography>
  </Slide>
  nduit!
</Typography>
</Box> */
}
