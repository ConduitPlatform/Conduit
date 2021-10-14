import React from 'react';
import { Drawer, Theme, Typography } from '@material-ui/core';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItem from '@material-ui/core/ListItem';
import List from '@material-ui/core/List';
import Divider from '@material-ui/core/Divider';
import { ExitToApp, Settings } from '@material-ui/icons';
import Router from 'next/router';
import { asyncLogout } from '../../redux/slices/appAuthSlice';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import Modules from '../modules/Modules';
import Link from 'next/link';
import clsx from 'clsx';

const useStyles = makeStyles((theme: Theme) => ({
  drawer: {
    width: 200,
  },
  title: {
    color: theme.palette.secondary.main,
    paddingTop: theme.spacing(2),
  },
  listContainer: {
    padding: theme.spacing(1),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  toolbar: theme.mixins.toolbar,
  listItem: {
    height: theme.spacing(5),
    borderRadius: theme.spacing(0.5),
    marginBottom: theme.spacing(2),
    color: theme.palette.secondary.main,
    borderWidth: 1,
    paddingLeft: theme.spacing(0.5),
    paddingRight: theme.spacing(0.5),
    '&:hover': {
      borderWidth: 1,
    },
    '&:focus': {
      borderWidth: 1,
    },
    '&.Mui-selected': {
      color: theme.palette.common.white,
      borderWidth: 1,
      '&:hover': {
        background: theme.palette.secondary.dark,
        borderWidth: 1,
      },
      '&:focus': {
        background: theme.palette.secondary.dark,
        borderWidth: 1,
      },
    },
  },
  listItemText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  listItemIcon: {
    minWidth: theme.spacing(4),
    marginRight: theme.spacing(1),
    color: 'inherit',
  },
  logoutContainer: {
    margin: 0,
    paddingLeft: theme.spacing(1),
  },
}));

interface Props {
  itemSelected?: string;
}

const CustomDrawer: React.FC<Props> = ({ itemSelected, ...rest }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const { enabledModules, disabledModules } = useAppSelector((state) => state.appAuthSlice.data);

  const handleLogout = async () => {
    dispatch(asyncLogout());
    await Router.replace('/login');
  };

  return (
    <Drawer variant="permanent" className={classes.drawer} open={true} {...rest}>
      <ListItem className={classes.title}>
        <Typography variant="h5">Conduit</Typography>
      </ListItem>
      <div className={classes.listContainer}>
        <List component="nav">
          <Modules modules={enabledModules} homeEnabled itemSelected={itemSelected} />
          <Link href={`/settings/clientsdk`} passHref>
            <ListItem button className={classes.listItem} selected={itemSelected === 'settings'}>
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
        <ListItem
          button
          className={clsx(classes.listItem, classes.logoutContainer)}
          onClick={handleLogout}>
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
