import React from 'react';
import { Drawer, Theme } from '@material-ui/core';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItem from '@material-ui/core/ListItem';
import List from '@material-ui/core/List';
import Divider from '@material-ui/core/Divider';
import { ExitToApp, Menu, ChevronLeft, Settings } from '@material-ui/icons';
import clsx from 'clsx';
import Router from 'next/router';
import { asyncLogout } from '../../redux/slices/appAuthSlice';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import Modules from '../modules/Modules';
import Link from 'next/link';

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
    fontSize: 12,
  },
  listItemIcon: {
    minWidth: 36,
    marginRight: theme.spacing(1),
    color: 'inherit',
  },
}));

interface Props {
  open: boolean;
  setOpen: (value: boolean) => void;
  itemSelected?: string;
}

const CustomDrawer: React.FC<Props> = ({ open, setOpen, itemSelected, ...rest }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const { enabledModules, disabledModules } = useAppSelector((state) => state.appAuthSlice.data);

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
        <List component="nav">
          <Modules modules={enabledModules} homeEnabled itemSelected={itemSelected} />
          <Link href="/settings/clientsdk" passHref>
            <ListItem
              button
              className={classes.listItem}
              style={itemStyle}
              selected={itemSelected === 'settings'}>
              <ListItemIcon className={classes.listItemIcon}>
                <Settings color={'inherit'} />
              </ListItemIcon>
              <ListItemText primary={'Settings'} classes={{ primary: classes.listItemText }} />
            </ListItem>
          </Link>
          <Divider />
          {disabledModules.length > 0 ? (
            <>
              <Modules modules={disabledModules} itemSelected={itemSelected} />
              <Divider />
            </>
          ) : (
            <></>
          )}
        </List>
        <ListItem button className={classes.listItem} style={itemStyle} onClick={handleLogout}>
          <ListItemIcon className={classes.listItemIcon}>
            <ExitToApp color={'inherit'} />
          </ListItemIcon>
          <ListItemText primary={'Log out'} classes={{ primary: classes.listItemText }} />
        </ListItem>
      </div>
    </Drawer>
  );
};

export default CustomDrawer;
