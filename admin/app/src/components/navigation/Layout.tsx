import React, { useState, useEffect } from 'react';
import CustomDrawer from './Drawer';
import { useRouter } from 'next/router';
import { asyncGetAdminModules } from '../../redux/slices/appAuthSlice';
import { Theme } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import NotificationsSystem, { atalhoTheme, dismissNotification } from 'reapop';

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
  const notifications = useAppSelector((state) => state.notifications);
  const { loading } = useAppSelector((state) => state.appSlice);
  const [open, setOpen] = useState<boolean>(false);
  const [menuDisabled, setMenuDisabled] = useState<boolean>(false);
  const [itemSelected, setItemSelected] = useState<number>(0);

  useEffect(() => {
    switch (router.pathname) {
      case '/':
        setItemSelected(0);
        break;
      case '/authentication/users':
        setItemSelected(1);
        break;
      case '/authentication/settings':
        setItemSelected(1);
        break;
      case '/authentication/serviceAccounts':
        setItemSelected(1);
        break;
      case '/authentication/signIn':
        setItemSelected(1);
        break;
      case '/notification':
        setItemSelected(2);
        break;
      case '/sms':
        setItemSelected(3);
        break;
      case '/emails/templates':
        setItemSelected(4);
        break;
      case '/emails/send':
        setItemSelected(4);
        break;
      case '/emails/provider':
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

    if (router.pathname === '/login' || router.pathname === '/cms/build-types') {
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

  return (
    <div className={classes.root} {...rest}>
      {!menuDisabled ? <CustomDrawer itemSelected={itemSelected} setOpen={setOpen} open={open} /> : <></>}
      <main className={classes.content}>
        <div className={classes.toolbar} />
        {children}
      </main>
      <NotificationsSystem
        notifications={notifications}
        dismissNotification={(id) => dispatch(dismissNotification(id))}
        theme={atalhoTheme}
      />
      <Backdrop open={loading} className={classes.backdrop}>
        <CircularProgress color="secondary" />
      </Backdrop>
    </div>
  );
};
