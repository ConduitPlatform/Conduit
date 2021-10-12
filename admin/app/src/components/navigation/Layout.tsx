import React, { useState, useEffect } from 'react';
import CustomDrawer from './Drawer';
import { useRouter } from 'next/router';
import { asyncGetAdminModules } from '../../redux/slices/appAuthSlice';
import { Theme } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import useNotifier from '../../utils/useNotifier';

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
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
  snackBar: {
    maxWidth: '80%',
    width: 'auto',
  },
}));

export const Layout: React.FC = ({ children, ...rest }) => {
  useNotifier();
  const classes = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { token } = useAppSelector((state) => state.appAuthSlice.data);
  const { loading } = useAppSelector((state) => state.appSlice);
  const [open, setOpen] = useState<boolean>(false);
  const [menuDisabled, setMenuDisabled] = useState<boolean>(false);
  const [itemSelected, setItemSelected] = useState<string>('');

  useEffect(() => {
    const splitUri = router.pathname.split('/')[1];
    switch (splitUri) {
      case 'authentication':
        setItemSelected('authentication');
        break;
      case 'push-notifications':
        setItemSelected('push-notifications');
        break;
      case 'sms':
        setItemSelected('sms');
        break;
      case 'emails':
        setItemSelected('email');
        break;
      case 'cms':
        setItemSelected('cms');
        break;
      case 'storage':
        setItemSelected('storage');
        break;
      case 'settings':
        setItemSelected('settings');
        break;
      case 'chat':
        setItemSelected('chat');
        break;
      case 'forms':
        setItemSelected('forms');
        break;
      case 'payments':
        setItemSelected('payments');
        break;
      case 'database-provider':
        setItemSelected('database-provider');
        break;
      default:
        setItemSelected('');
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
      {!menuDisabled ? (
        <CustomDrawer itemSelected={itemSelected} setOpen={setOpen} open={open} />
      ) : (
        <></>
      )}
      <main className={classes.content}>{children}</main>
      <Backdrop open={loading} className={classes.backdrop}>
        <CircularProgress color="secondary" />
      </Backdrop>
    </div>
  );
};
