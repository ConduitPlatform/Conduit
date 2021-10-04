import React from 'react';
import { Theme } from '@material-ui/core';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import ListItem from '@material-ui/core/ListItem';
import { Home } from '@material-ui/icons';
import Link from 'next/link';
import { makeStyles } from '@material-ui/core/styles';
import { useAppSelector } from '../../redux/store';
import { getModuleIcon } from './moduleUtils';

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

interface Props {}

const Modules: React.FC<Props> = () => {
  const classes = useStyles();
  const { enabledModules, disabledModules } = useAppSelector((state) => state.appAuthSlice.data);

  console.log('disabledModules', disabledModules);

  const itemStyle = {
    height: '34px',
    borderRadius: '4px',
    marginBottom: '12px',
  };

  const handleModuleName = (moduleName: string) => {
    return moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  };

  const handleNavigation = (moduleName: string) => {
    switch (moduleName) {
      case 'authentication':
        return '/authentication/users';
      case 'email':
        return '/emails/templates';
      case 'cms':
        return '/cms/schemas';
      default:
        return `/${moduleName}`;
    }
  };

  return (
    <>
      <Link href="/">
        <ListItem
          button
          key={'Home'}
          className={classes.listItem}
          style={itemStyle}
          // selected={itemSelected === 0}
        >
          <ListItemIcon className={classes.listItemIcon}>
            <Home color={'inherit'} />
          </ListItemIcon>
          <ListItemText primary={'Home'} classes={{ primary: classes.listItemText }} />
        </ListItem>
      </Link>
      {enabledModules &&
        enabledModules.map((module, index) => {
          const currentUrl = handleNavigation(module.moduleName);
          return (
            <Link href={currentUrl} key={index} replace>
              <ListItem
                button
                className={classes.listItem}
                style={itemStyle}
                // selected={itemSelected === 0}
              >
                <ListItemIcon className={classes.listItemIcon}>
                  {getModuleIcon(module.moduleName)}
                </ListItemIcon>
                <ListItemText
                  primary={handleModuleName(module.moduleName)}
                  classes={{ primary: classes.listItemText }}
                />
              </ListItem>
            </Link>
          );
        })}
    </>
  );
};

export default Modules;
