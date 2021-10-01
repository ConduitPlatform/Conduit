import React from 'react';
import { Drawer, Theme } from '@material-ui/core';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItem from '@material-ui/core/ListItem';
import List from '@material-ui/core/List';
import Divider from '@material-ui/core/Divider';
import {
  Email,
  ExitToApp,
  Home,
  Notifications,
  People,
  Settings,
  Toc,
  Cloud,
  Sms,
  Menu,
  ChevronLeft,
} from '@material-ui/icons';
import clsx from 'clsx';
import Link from 'next/link';
import Router from 'next/router';
import { asyncLogout } from '../../redux/slices/appAuthSlice';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../redux/store';

const drawerWidth = 200;
const drawerWidthClosed = 52;

const useStyles = makeStyles((theme: Theme) => ({
  drawerOpen: {
    width: drawerWidth,
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  drawerClose: {
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    overflowX: 'hidden',
    width: drawerWidthClosed,
  },
  toolbar: theme.mixins.toolbar,
  listItem: {
    color: theme.palette.secondary.main,
    borderWidth: '1px',
    paddingLeft: 4,
    paddingRight: 4,
    '&:hover': {
      borderWidth: '1px',
    },
    '&:focus': {
      borderWidth: '1px',
    },
    '&.Mui-selected': {
      color: theme.palette.common.white,
      borderWidth: '1px',
      '&:hover': {
        background: theme.palette.secondary.dark,
        borderWidth: '1px',
      },
      '&:focus': {
        background: theme.palette.secondary.dark,
        borderWidth: '1px',
      },
    },
  },
  listItemText: {
    fontWeight: 'bold',
  },
  listItemIcon: {
    minWidth: 36,
    marginRight: theme.spacing(1),
    color: 'inherit',
  },
}));

interface IModule {
  moduleName: string;
  url: string;
}

interface Props {
  open: boolean;
  setOpen: (value: boolean) => void;
  itemSelected?: number;
}

const CustomDrawer: React.FC<Props> = ({ open, setOpen, itemSelected, ...rest }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const { enabledModules } = useAppSelector((state) => state.appAuthSlice.data);

  const drawerOpen = () => {
    if (open === null || open === undefined) {
      return false;
    }
    return open;
  };

  const divStyle = {
    padding: '8px',
  };

  const itemStyle = {
    height: '34px',
    borderRadius: '4px',
    marginBottom: '12px',
  };

  const handleLogout = async () => {
    dispatch(asyncLogout());
    await Router.replace('/login');
  };

  const isModuleDisabled = (moduleName: string) => {
    const found = enabledModules.find((module: IModule) => module.moduleName === moduleName);
    return !found;
  };

  return (
    <Drawer
      variant="permanent"
      className={clsx({
        [classes.drawerOpen]: drawerOpen(),
        [classes.drawerClose]: !drawerOpen(),
      })}
      classes={{
        paper: clsx({
          [classes.drawerOpen]: drawerOpen(),
          [classes.drawerClose]: !drawerOpen(),
        }),
      }}
      open={drawerOpen()}
      {...rest}>
      <ListItem className={classes.listItem}>
        <ListItemIcon style={{ margin: '4px' }} onClick={() => setOpen(!open)}>
          {!open ? (
            <Menu className={classes.listItemIcon} style={{ color: '#07D9C4' }} />
          ) : (
            <ChevronLeft className={classes.listItemIcon} style={{ color: '#07D9C4' }} />
          )}
        </ListItemIcon>
      </ListItem>

      <div className={classes.toolbar} />

      <div className={classes.toolbar} />

      <div style={divStyle}>
        <Divider />

        <List component="nav">
          <Link href="/">
            <ListItem button key={'Home'} className={classes.listItem} style={itemStyle} selected={itemSelected === 0}>
              <ListItemIcon className={classes.listItemIcon}>
                <Home color={'inherit'} />
              </ListItemIcon>
              <ListItemText primary={'Home'} classes={{ primary: classes.listItemText }} />
            </ListItem>
          </Link>
          <Link href="/authentication/users" prefetch={false}>
            <ListItem
              button
              disabled={isModuleDisabled('authentication')}
              key={'Authentication'}
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 1}>
              <ListItemIcon className={classes.listItemIcon}>
                <People color={'inherit'} />
              </ListItemIcon>
              <ListItemText primary={'Authentication'} classes={{ primary: classes.listItemText }} />
            </ListItem>
          </Link>
          <Link href="/notification">
            <ListItem
              disabled={isModuleDisabled('notification')}
              button
              key={'Notification'}
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 2}>
              <ListItemIcon className={classes.listItemIcon}>
                <Notifications color={'inherit'} />
              </ListItemIcon>
              <ListItemText primary={'Notification'} classes={{ primary: classes.listItemText }} />
            </ListItem>
          </Link>
          <Link href="/sms">
            <ListItem
              disabled={isModuleDisabled('sms')}
              button
              key={'sms'}
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 3}>
              <ListItemIcon className={classes.listItemIcon}>
                <Sms color={'inherit'} />
              </ListItemIcon>
              <ListItemText primary={'SMS'} classes={{ primary: classes.listItemText }} />
            </ListItem>
          </Link>
          <Link href="/emails">
            <ListItem
              disabled={isModuleDisabled('email')}
              button
              key={'Emails'}
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 4}>
              <ListItemIcon className={classes.listItemIcon}>
                <Email color={'inherit'} />
              </ListItemIcon>
              <ListItemText primary={'Emails'} classes={{ primary: classes.listItemText }} />
            </ListItem>
          </Link>
          <Link href="/cms">
            <ListItem
              button
              disabled={isModuleDisabled('cms')}
              key={'CMS'}
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 5}>
              <ListItemIcon className={classes.listItemIcon}>
                <Toc color={'inherit'} />
              </ListItemIcon>
              <ListItemText primary={'CMS'} classes={{ primary: classes.listItemText }} />
            </ListItem>
          </Link>
          <Link href="/storage">
            <ListItem
              button
              key={'Storage'}
              disabled={isModuleDisabled('storage')}
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 6}>
              <ListItemIcon className={classes.listItemIcon}>
                <Cloud color={'inherit'} />
              </ListItemIcon>
              <ListItemText primary={'Storage'} classes={{ primary: classes.listItemText }} />
            </ListItem>
          </Link>
          <Link href="/settings/clientsdk">
            <ListItem
              button
              key={'Settings'}
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 7}>
              <ListItemIcon className={classes.listItemIcon}>
                <Settings color={'inherit'} />
              </ListItemIcon>
              <ListItemText primary={'Settings'} classes={{ primary: classes.listItemText }} />
            </ListItem>
          </Link>
        </List>
        <Divider />
        <List>
          <ListItem button className={classes.listItem} style={itemStyle} onClick={handleLogout}>
            <ListItemIcon className={classes.listItemIcon}>
              <ExitToApp color={'inherit'} />
            </ListItemIcon>
            <ListItemText primary={'Log out'} classes={{ primary: classes.listItemText }} />
          </ListItem>
        </List>
      </div>
    </Drawer>
  );
};

export default CustomDrawer;
