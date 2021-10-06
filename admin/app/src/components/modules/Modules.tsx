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
import { notify } from 'reapop';
import { useAppDispatch } from '../../redux/store';

const useStyles = makeStyles((theme: Theme) => ({
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
    textTransform: 'capitalize',
    fontSize: 12,
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
  modules: IModule[];
  itemSelected?: string;
  homeEnabled?: boolean;
}

const Modules: React.FC<Props> = ({ modules, homeEnabled, itemSelected }) => {
  const classes = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const itemStyle = {
    height: '34px',
    borderRadius: '4px',
    margin: '8px 0',
  };

  const handleItemClick = (url: string, enabled: boolean) => {
    if (enabled) {
      router.replace(url);
      return;
    }
    dispatch(
      notify('Module currently disabled.', 'info', {
        dismissAfter: 3000,
      })
    );
  };

  return (
    <>
      {homeEnabled ? (
        <Link href="/">
          <ListItem
            button
            className={classes.listItem}
            style={itemStyle}
            selected={itemSelected === ''}>
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
              style={itemStyle}
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
