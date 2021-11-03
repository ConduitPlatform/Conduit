import { createStyles, makeStyles } from '@material-ui/core';

export default makeStyles((theme) =>
  createStyles({
    navBar: {
      position: 'fixed',
      top: 0,
      backgroundColor: '#262840',
      width: '100vw',
      padding: theme.spacing(0.5),
      zIndex: 10,
    },
    content: {
      marginTop: '110px',
    },
    swaggerButton: {
      textDecoration: 'none',
      marginLeft: theme.spacing(8),
    },
    navContent: {
      marginTop: '10px',
    },
    chatRoot: {
      height: '100vh',
    },
    chatContent: {
      marginTop: '110px',
      height: 'calc(100% - 110px)',
    },
  })
);
