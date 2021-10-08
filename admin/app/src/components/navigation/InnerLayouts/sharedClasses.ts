import { createStyles, makeStyles } from '@material-ui/core';

export default makeStyles((theme) =>
  createStyles({
    navBar: {
      position: 'fixed',
      top: 0,
      backgroundColor: '#262840',
      width: '100vw',
      padding: '9px',
      zIndex: 10,
    },
    content: {
      marginTop: '120px',
      padding: 3,
    },
    swaggerButton: {
      textDecoration: 'none',
      marginLeft: '40px',
    },
  })
);
