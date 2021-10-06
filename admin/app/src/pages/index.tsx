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
  Button,
  Link,
} from '@material-ui/core';
import EmailIcon from '@material-ui/icons/Email';
import LockIcon from '@material-ui/icons/Lock';
import SchemaIcon from '@material-ui/icons/VerticalSplit';
import SectetIcon from '@material-ui/icons/VpnKey';
import Description from '@material-ui/icons/Description';
import { ArrowForward } from '@material-ui/icons';
import Storage from '@material-ui/icons/Storage';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    paper: {
      height: 125,
      width: 300,
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
          justifyContent="flex-end"
          alignItems={'flex-end'}
          flex={1}
          style={{ marginBottom: '20px' }}>
          <a
            href="https://quintessential-sft.github.io/conduit/"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none' }}>
            <Button variant="outlined" startIcon={<Description />}>
              DOCUMENTATION
            </Button>
          </a>
        </Box>
        <Box p={2} display={'flex'} alignItems={'center'} flex={1} style={{ marginBottom: '200px' }}>
          <Typography variant={'h4'} className={classes.welcomeTypography}>
            Welcome to C
            <Slide timeout={1000} in direction={'down'}>
              <Typography variant={'h4'} component={'span'} role="img" aria-label="okhand">
                👌
              </Typography>
            </Slide>
            nduit!
          </Typography>
        </Box>

        <Container>
          <Grid container spacing={6}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper className={classes.paper} variant="elevation">
                <div className={classes.textIcon}>
                  <SectetIcon className={classes.headerIcon} />
                  <Typography> &nbsp; set up an auth method</Typography>
                </div>
                <Divider className={classes.divider} />
                <Typography variant="subtitle2">
                  Easily login with the method of your choice!
                  <IconButton className={classes.iconButton} size="small">
                    <Link href="/authentication/signIn">
                      <ArrowForward />
                    </Link>
                  </IconButton>
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper className={classes.paper} variant="elevation">
                <div className={classes.textIcon}>
                  <SchemaIcon className={classes.headerIcon} />
                  <Typography align="center">&nbsp; create a schema</Typography>
                </div>
                <Divider className={classes.divider} />
                <Typography variant="subtitle2">
                  Create your schema with a user friendly UI!
                  <IconButton className={classes.iconButton} size="small">
                    <Link href="/cms/build-types">
                      <ArrowForward />
                    </Link>
                  </IconButton>
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper className={classes.paper} variant="elevation">
                <div className={classes.textIcon}>
                  <Storage className={classes.headerIcon} />
                  <Typography>&nbsp; add data </Typography>
                </div>
                <Divider className={classes.divider} />
                <Typography variant="subtitle2">
                  Add data to your newly created schema!
                  <IconButton className={classes.iconButton} size="small">
                    <Link href="/cms/schemadata">
                      <ArrowForward />
                    </Link>
                  </IconButton>
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper className={classes.paper} variant="elevation">
                <div className={classes.textIcon}>
                  <EmailIcon className={classes.headerIcon} />
                  <Typography> &nbsp;set up email provider</Typography>
                </div>
                <Divider className={classes.divider} />
                <Typography variant="subtitle2">
                  Select your preferred provider and start mailing!
                  <IconButton className={classes.iconButton} size="small">
                    <Link href="/emails/provider">
                      <ArrowForward />
                    </Link>
                  </IconButton>
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={6} md={3}>
              <Paper className={classes.paper} variant="elevation">
                <div className={classes.textIcon}>
                  <LockIcon className={classes.headerIcon} />
                  <Typography>&nbsp; set up client secrets</Typography>
                </div>
                <Divider className={classes.divider} />
                <Typography variant="subtitle2">
                  Set up your client secret across multiple platforms!
                  <IconButton className={classes.iconButton} size="small">
                    <Link href="/settings/secrets">
                      <ArrowForward />
                    </Link>
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
