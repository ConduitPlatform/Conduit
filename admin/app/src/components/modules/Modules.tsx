import React from 'react';
import { Theme } from '@material-ui/core';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItem from '@material-ui/core/ListItem';
import { Home } from '@material-ui/icons';
import Link from 'next/link';
import { makeStyles } from '@material-ui/core/styles';
import { getModuleIcon, handleModuleNavigation } from './moduleUtils';
import { useRouter } from 'next/router';
import { useAppDispatch } from '../../redux/store';
import { enqueueInfoNotification } from '../../utils/useNotifier';

const useStyles = makeStyles((theme: Theme) => ({
  listItem: {
    minHeight: theme.spacing(4),
    borderRadius: theme.spacing(0.5),
    margin: theme.spacing(1, 0),
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
    textTransform: 'capitalize',
    fontSize: 12,
  },
  listItemIcon: {
    minWidth: theme.spacing(4),
    marginRight: theme.spacing(1),
    color: 'inherit',
  },
}));

interface IModule {
  moduleName: string;
  url: string;
}

interface Props {
  modules: IModule[];
  itemSelected?: string;
  homeEnabled?: boolean;
}

const Modules: React.FC<Props> = ({ modules, homeEnabled, itemSelected }) => {
  const classes = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const handleItemClick = (url: string, enabled: boolean) => {
    if (enabled) {
      router.replace(url);
      return;
    }
    dispatch(enqueueInfoNotification('Module currently disabled.'));
  };

  return (
    <>
      {homeEnabled ? (
        <Link href="/" passHref>
          <ListItem button className={classes.listItem} selected={itemSelected === ''}>
            <ListItemIcon className={classes.listItemIcon}>
              <Home color={'inherit'} />
            </ListItemIcon>
            <ListItemText primary={'home'} classes={{ primary: classes.listItemText }} />
          </ListItem>
        </Link>
      ) : (
        <></>
      )}
      {modules &&
        modules.map((module, index) => {
          const currentUrl = handleModuleNavigation(module.moduleName);
          return (
            <ListItem
              button
              className={classes.listItem}
              selected={itemSelected === module.moduleName}
              key={index}
              onClick={() => handleItemClick(currentUrl, !!module.url)}>
              <ListItemIcon className={classes.listItemIcon}>
                {getModuleIcon(module.moduleName)}
              </ListItemIcon>
              <ListItemText
                primary={module.moduleName}
                classes={{ primary: classes.listItemText }}
              />
            </ListItem>
          );
        })}
    </>
  );
};

export default Modules;
