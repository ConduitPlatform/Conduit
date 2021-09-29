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
  IconButton,
  Divider,
} from '@material-ui/core';
import EmailIcon from '@material-ui/icons/Email';
import LockIcon from '@material-ui/icons/Lock';
import SchemaIcon from '@material-ui/icons/VerticalSplit';
import SectetIcon from '@material-ui/icons/VpnKey';
import { ArrowForward } from '@material-ui/icons';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    paper: {
      height: 160,
      width: 270,
      display: 'flex',
      padding: '20px',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: theme.palette.primary.main,
      flexDirection: 'column',
      backgroundColor: theme.palette.background.default,

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
    iconButton: {
      color: theme.palette.secondary.main,
    },
    headerIcon: {
      color: theme.palette.secondary.main,
      marginLeft: '1px',
    },
    divider: {
      color: theme.palette.primary.main,
      marginBottom: '10px',
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
        <Grid container justify="center" alignItems="center" spacing={6}>
          <Grid item xs={6} sm={6} md={3}>
            <Paper className={classes.paper} variant="elevation">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}>
                <SectetIcon className={classes.headerIcon} />
                <Typography>set up an auth method</Typography>
              </div>
              <Divider className={classes.divider} />
              <Typography variant="subtitle2">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam vel commodo
                quam.
                <IconButton className={classes.iconButton} size="small">
                  <ArrowForward />
                </IconButton>
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <Paper className={classes.paper} variant="elevation">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}>
                <SchemaIcon className={classes.headerIcon} />
                <Typography align="center">create a schema</Typography>
              </div>
              <Divider className={classes.divider} />
              <Typography variant="subtitle2">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam vel commodo
                quam.
                <IconButton className={classes.iconButton} size="small">
                  <ArrowForward />
                </IconButton>
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <Paper className={classes.paper} variant="elevation">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}>
                <EmailIcon className={classes.headerIcon} />
                <Typography>set up email provider</Typography>
              </div>
              <Divider className={classes.divider} />
              <Typography variant="subtitle2">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam vel commodo
                quam.
                <IconButton className={classes.iconButton} size="small">
                  <ArrowForward />
                </IconButton>
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={6} md={3}>
            <Paper className={classes.paper} variant="elevation">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}>
                <LockIcon className={classes.headerIcon} />
                <Typography>set up client secrets</Typography>
              </div>
              <Divider className={classes.divider} />
              <Typography variant="subtitle2">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam vel commodo
                quam.
                <IconButton className={classes.iconButton} size="small">
                  <ArrowForward />
                </IconButton>
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </>
  );
};

export default Home;

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
