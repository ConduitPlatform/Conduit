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
      height: 125,
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
    textIcon: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    welcomeTypography: {
      display: 'flex',
      justifyContent: 'center',
      flex: 1,
    },
  })
);
import theme from '../theme';

const Home = () => {
  const classes = useStyles();
  return (
    <>
      <Head>
        <title>Conduit - App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div>
        <Box
          p={2}
          display={'flex'}
          alignItems={'center'}
          flex={1}
          style={{ marginBottom: '300px' }}>
          <Typography variant={'h4'} className={classes.welcomeTypography}>
            Welcome to C
            <Slide timeout={1000} in direction={'down'}>
              <Typography
                variant={'h4'}
                component={'span'}
                role="img"
                aria-label="okhand">
                👌
              </Typography>
            </Slide>
            nduit!
          </Typography>
        </Box>

        <Container>
          <Grid container spacing={6}>
            <Grid item xs={6} sm={6} md={3}>
              <Paper className={classes.paper} variant="elevation">
                <div className={classes.textIcon}>
                  <SectetIcon className={classes.headerIcon} />
                  <Typography>set up an auth method</Typography>
                </div>
                <Divider className={classes.divider} />
                <Typography variant="subtitle2">
                  Easily login with the method of your choice!
                  <IconButton className={classes.iconButton} size="small">
                    <ArrowForward />
                  </IconButton>
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={6} md={3}>
              <Paper className={classes.paper} variant="elevation">
                <div className={classes.textIcon}>
                  <SchemaIcon className={classes.headerIcon} />
                  <Typography align="center">create a schema</Typography>
                </div>
                <Divider className={classes.divider} />
                <Typography variant="subtitle2">
                  Create your schema with a user friendly UI!
                  <IconButton className={classes.iconButton} size="small">
                    <ArrowForward />
                  </IconButton>
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={6} md={3}>
              <Paper className={classes.paper} variant="elevation">
                <div className={classes.textIcon}>
                  <EmailIcon className={classes.headerIcon} />
                  <Typography>set up email provider</Typography>
                </div>
                <Divider className={classes.divider} />
                <Typography variant="subtitle2">
                  Select your preferred provider and start mailing!
                  <IconButton className={classes.iconButton} size="small">
                    <ArrowForward />
                  </IconButton>
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={6} md={3}>
              <Paper className={classes.paper} variant="elevation">
                <div className={classes.textIcon}>
                  <LockIcon className={classes.headerIcon} />
                  <Typography>set up client secrets</Typography>
                </div>
                <Divider className={classes.divider} />
                <Typography variant="subtitle2">
                  Set up your client secret across multiple platforms!
                  <IconButton className={classes.iconButton} size="small">
                    <ArrowForward />
                  </IconButton>
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </div>
    </>
  );
};

export default Home;
