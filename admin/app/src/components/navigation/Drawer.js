import React from 'react';
import { Drawer } from '@material-ui/core';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItem from '@material-ui/core/ListItem';
import List from '@material-ui/core/List';
import Divider from '@material-ui/core/Divider';
import makeStyles from '@material-ui/styles/makeStyles';
import {
  Email,
  ExitToApp,
  Home,
  Notifications,
  People,
  Settings,
  Toc,
  Cloud,
} from '@material-ui/icons';
import clsx from 'clsx';
import Link from 'next/link';
import Router from 'next/router';
import { useDispatch } from 'react-redux';
import { logout } from '../../redux/thunks/appAuthThunks';

const drawerWidth = 200;
const drawerWidthClosed = 52;

const useStyles = makeStyles((theme) => ({
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
    color: theme.palette.primary.main,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: theme.palette.primary.main,
    paddingLeft: 4,
    paddingRight: 4,
    '&:hover': {
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: theme.palette.primary.main,
    },
    '&:focus': {
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: theme.palette.primary.main,
    },
    '&.Mui-selected': {
      color: theme.palette.common.white,
      background: theme.palette.primary.main,
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: theme.palette.primary.main,
      '&:hover': {
        background: theme.palette.primary.dark,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: theme.palette.primary.dark,
      },
      '&:focus': {
        background: theme.palette.primary.dark,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: theme.palette.primary.dark,
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

function CustomDrawer(props) {
  const classes = useStyles();
  const dispatch = useDispatch();

  const { open, itemSelected, ...rest } = props;

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

  const handleLogout = () => {
    dispatch(logout());
    Router.replace('/login');
  };

  return (
    <Drawer
      variant="permanent"
      className={clsx(classes.drawer, {
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
      <div className={classes.toolbar} />

      <div className={classes.toolbar} />

      <div style={divStyle}>
        <Divider />

        <List component="nav">
          <Link href="/">
            <ListItem
              button
              key={'Home'}
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 0}>
              <ListItemIcon className={classes.listItemIcon}>
                <Home color={'inherit'} />
              </ListItemIcon>
              <ListItemText
                primary={'Home'}
                classes={{ primary: classes.listItemText }}
              />
            </ListItem>
          </Link>
          <Link href="/authentication">
            <ListItem
              button
              key={'Authentication'}
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 1}>
              <ListItemIcon className={classes.listItemIcon}>
                <People color={'inherit'} />
              </ListItemIcon>
              <ListItemText
                primary={'Authentication'}
                classes={{ primary: classes.listItemText }}
              />
            </ListItem>
          </Link>
          <Link href="/notification">
            <ListItem
              button
              key={'Notification'}
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 2}>
              <ListItemIcon className={classes.listItemIcon}>
                <Notifications color={'inherit'} />
              </ListItemIcon>
              <ListItemText
                primary={'Notification'}
                classes={{ primary: classes.listItemText }}
              />
            </ListItem>
          </Link>
          <Link href="/emails">
            <ListItem
              button
              key={'Emails'}
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 3}>
              <ListItemIcon className={classes.listItemIcon}>
                <Email color={'inherit'} />
              </ListItemIcon>
              <ListItemText
                primary={'Emails'}
                classes={{ primary: classes.listItemText }}
              />
            </ListItem>
          </Link>
          <Link href="/cms">
            <ListItem
              button
              key={'CMS'}
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 4}>
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
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 5}>
              <ListItemIcon className={classes.listItemIcon}>
                <Cloud color={'inherit'} />
              </ListItemIcon>
              <ListItemText
                primary={'Storage'}
                classes={{ primary: classes.listItemText }}
              />
            </ListItem>
          </Link>
          <Link href="/settings">
            <ListItem
              button
              key={'Settings'}
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 6}>
              <ListItemIcon className={classes.listItemIcon}>
                <Settings color={'inherit'} />
              </ListItemIcon>
              <ListItemText
                primary={'Settings'}
                classes={{ primary: classes.listItemText }}
              />
            </ListItem>
          </Link>
        </List>
        <Divider />
        <List>
          <ListItem
            button
            className={classes.listItem}
            style={itemStyle}
            onClick={handleLogout}>
            <ListItemIcon className={classes.listItemIcon}>
              <ExitToApp color={'inherit'} />
            </ListItemIcon>
            <ListItemText
              primary={'Log out'}
              classes={{ primary: classes.listItemText }}
            />
          </ListItem>
        </List>
      </div>
    </Drawer>
  );
}

export default CustomDrawer;
