import React, { useState, useEffect } from 'react';
import CustomDrawer from './Drawer';
import CustomHeader from './Header';
import { useRouter } from 'next/router';
import { asyncGetAdminModules } from '../../redux/slices/appAuthSlice';
import { Theme } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import Snackbar from '@material-ui/core/Snackbar';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import Alert from '@material-ui/lab/Alert';
import Box from '@material-ui/core/Box';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    display: 'flex',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    padding: 0,
    minHeight: '100vh',
  },
  toolbar: theme.mixins.toolbar,
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
  snackBar: {
    maxWidth: '80%',
    width: 'auto',
  },
}));

export const Layout: React.FC = ({ children, ...rest }) => {
  const classes = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { token } = useAppSelector((state) => state.appAuthSlice.data);
  const { loading, error } = useAppSelector((state) => state.appSlice);
  const [open, setOpen] = useState<boolean>(false);
  const [menuDisabled, setMenuDisabled] = useState<boolean>(false);
  const [itemSelected, setItemSelected] = useState<number>(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    if (error) {
      setSnackbarOpen(true);
    }
  }, [error]);

  useEffect(() => {
    switch (router.pathname) {
      case '/':
        setItemSelected(0);
        break;
      case '/authentication':
        setItemSelected(1);
        break;
      case '/notification':
        setItemSelected(2);
        break;
      case '/sms':
        setItemSelected(3);
        break;
      case '/emails':
        setItemSelected(4);
        break;
      case '/cms':
        setItemSelected(5);
        break;
      case '/storage':
        setItemSelected(6);
        break;
      case '/settings':
        setItemSelected(7);
        break;
      default:
        setItemSelected(0);
    }

    if (router.pathname === '/login') {
      setMenuDisabled(true);
      return;
    }
    setMenuDisabled(false);
  }, [router.pathname]);

  useEffect(() => {
    if (token) {
      dispatch(asyncGetAdminModules());
    }
  }, [dispatch, token]);

  const menuClick = () => {
    setOpen(!open);
  };

  const logoClick = async () => {
    await router.push('/');
  };

  let appBar, drawer;
  if (!menuDisabled) {
    appBar = (
      <CustomHeader onMenuClick={() => menuClick()} onLogoClick={() => logoClick()} />
    );
    drawer = <CustomDrawer itemSelected={itemSelected} open={open} />;
  } else {
    appBar = <CustomHeader showMenuButton={false} onMenuClick={() => menuClick()} />;
  }

  const handleClose = () => {
    setSnackbarOpen(false);
  };

  const snackbarAlert = () => {
    const isError = Object.values(error).some((values) => values);
    if (isError) {
      return (
        <Alert variant={'filled'} onClose={handleClose} severity="error">
          <Box>
            {error.status} - {error.statusText} - {error.message}
          </Box>
        </Alert>
      );
    } else {
      return <div />;
    }
  };

  return (
    <div className={classes.root} {...rest}>
      {appBar}
      {drawer}
      <main className={classes.content}>
        <div className={classes.toolbar} />
        {children}
      </main>
      <Snackbar
        open={snackbarOpen}
        className={classes.snackBar}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snackbarAlert()}
      </Snackbar>
      <Backdrop open={loading} className={classes.backdrop}>
        <CircularProgress color="secondary" />
      </Backdrop>
    </div>
  );
};
