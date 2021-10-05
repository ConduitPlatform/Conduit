import Snackbar from '@material-ui/core/Snackbar';
import React from 'react';
import Alert from '@material-ui/lab/Alert';
import { makeStyles } from '@material-ui/core/styles';
import { SnackbarCloseReason } from '@material-ui/core/Snackbar/Snackbar';

const useStyles = makeStyles((theme) => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
  snackBar: {
    maxWidth: '80%',
    width: 'auto',
  },
}));

interface Props {
  successMessage: string | undefined;
  errorMessage?: Error | string | undefined;
  snackbarOpen: boolean;
  handleClose: (event: React.SyntheticEvent<any>, reason: SnackbarCloseReason) => void;
}

const AppState: React.FC<Props> = ({ successMessage, errorMessage, snackbarOpen, handleClose }) => {
  const classes = useStyles();

  return (
    <>
      <Snackbar
        open={snackbarOpen}
        className={classes.snackBar}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert variant={'filled'} severity={successMessage !== undefined ? 'success' : 'error'}>
          {successMessage !== undefined
            ? successMessage
            : errorMessage
            ? errorMessage
            : 'Something went wrong!'}
        </Alert>
      </Snackbar>
    </>
  );
};

export default AppState;
