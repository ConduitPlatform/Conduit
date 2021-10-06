import { createStyles, makeStyles, Theme } from '@material-ui/core';

export default makeStyles((theme: Theme) =>
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
  })
);