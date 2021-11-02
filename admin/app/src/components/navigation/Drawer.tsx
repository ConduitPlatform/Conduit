import React from 'react';
import { Paper, Theme, Typography } from '@material-ui/core';
import ListItem from '@material-ui/core/ListItem';
import List from '@material-ui/core/List';
import Divider from '@material-ui/core/Divider';
import { ExitToApp, Settings } from '@material-ui/icons';
import Router, { useRouter } from 'next/router';
import { asyncLogout } from '../../redux/slices/appAuthSlice';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import Modules from '../modules/Modules';
import CustomListItem from './CustomListItem';

const useStyles = makeStyles((theme: Theme) => ({
  drawer: {
    minWidth: 224,
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    color: theme.palette.secondary.main,
    paddingTop: theme.spacing(2),
  },
  listContainer: {
    padding: theme.spacing(1),
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
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
  const router = useRouter();

  const { enabledModules, disabledModules } = useAppSelector((state) => state.appAuthSlice.data);

  const handleLogout = async () => {
    dispatch(asyncLogout());
    await Router.replace('/login');
  };

  return (
    <Paper className={classes.drawer} elevation={2} {...rest}>
      <ListItem className={classes.title}>
        <Typography variant="h5">Conduit</Typography>
      </ListItem>
      <div className={classes.listContainer}>
        <List component="nav">
          <Divider />
          <Modules modules={enabledModules} homeEnabled itemSelected={itemSelected} />
          <CustomListItem
            selected={itemSelected === 'settings'}
            icon={<Settings color={'inherit'} />}
            title="Settings"
            onClick={() => router.replace('/settings/clientsdk')}
          />
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
        <CustomListItem
          icon={<ExitToApp color={'inherit'} />}
          title="Log out"
          onClick={() => handleLogout()}
          className={classes.logoutContainer}
        />
      </div>
    </Paper>
  );
};

export default CustomDrawer;
