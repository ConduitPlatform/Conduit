import React, { useState, useEffect } from 'react';
import CustomDrawer from './Drawer';
import CustomHeader from './Header';
import CssBaseline from '@material-ui/core/CssBaseline';
import { useRouter } from 'next/router';
import { asyncGetAdminModules } from '../../redux/slices/appAuthSlice';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { Theme } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

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
}));

interface Props {
  menuDisabled?: boolean;
  itemSelected?: number;
}

export const Layout: React.FC<Props> = ({ menuDisabled, itemSelected, ...rest }) => {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { token } = useAppSelector((state) => state.appAuthSlice.data);

  useEffect(() => {
    if (token) {
      dispatch(asyncGetAdminModules());
    }
  }, [dispatch, token]);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const menuClick = () => {
    open ? handleDrawerClose() : handleDrawerOpen();
  };

  const logoClick = async () => {
    await router.push('/');
  };

  const drawerDisabled = () => {
    if (menuDisabled === null || menuDisabled === undefined) {
      return false;
    }
    return menuDisabled;
  };

  let appBar, drawer;
  if (!drawerDisabled()) {
    appBar = (
      <CustomHeader onMenuClick={() => menuClick()} onLogoClick={() => logoClick()} />
    );
    drawer = <CustomDrawer itemSelected={itemSelected} open={open} />;
  } else {
    appBar = <CustomHeader showMenuButton={false} onMenuClick={() => menuClick()} />;
  }

  return (
    <div className={classes.root} {...rest}>
      <CssBaseline />
      {appBar}
      {drawer}
      <main className={classes.content}>
        <div className={classes.toolbar} />
        {rest.children}
      </main>
    </div>
  );
};
