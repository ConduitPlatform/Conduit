import React, { FC } from 'react';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import { makeStyles } from '@material-ui/core/styles';
import { ListItem, Theme } from '@material-ui/core';
import clsx from 'clsx';

const useStyles = makeStyles((theme: Theme) => ({
  listItem: {
    minHeight: theme.spacing(3),
    borderRadius: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
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
    textTransform: 'capitalize',
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
  title: string;
  icon: React.ReactElement;
  onClick: () => void;
  className?: string;
  selected?: boolean;
}

const CustomListItem: FC<Props> = ({ selected, title, icon, onClick, className, ...rest }) => {
  const classes = useStyles();
  return (
    <ListItem
      button
      className={clsx(classes.listItem, className)}
      selected={selected}
      onClick={onClick}
      {...rest}>
      <ListItemIcon className={classes.listItemIcon}>{icon}</ListItemIcon>
      <ListItemText primary={title} classes={{ primary: classes.listItemText }} />
    </ListItem>
  );
};

export default CustomListItem;
