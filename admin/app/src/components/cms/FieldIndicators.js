import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  icon: {
    height: theme.spacing(3),
    width: theme.spacing(3),
    marginRight: theme.spacing(1),
    opacity: 0.6,
    display: 'flex',
    alignItems: 'center',
  },
}));

const FieldIndicators = ({ item }) => {
  const classes = useStyles();

  return (
    <>
      {item.required && (
        <Tooltip title={'Required field'}>
          <Typography className={classes.icon} variant={'h6'}>
            R
          </Typography>
        </Tooltip>
      )}
      {item.unique && (
        <Tooltip title={'Unique field'}>
          <Typography className={classes.icon} variant={'h6'}>
            U
          </Typography>
        </Tooltip>
      )}
      {item.select && (
        <Tooltip title={'Selected field'}>
          <Typography className={classes.icon} variant={'h6'}>
            S
          </Typography>
        </Tooltip>
      )}
      {item.isArray && (
        <Tooltip title={'Array of selected type'}>
          <Typography className={classes.icon} variant={'h6'}>
            A
          </Typography>
        </Tooltip>
      )}
    </>
  );
};

export default FieldIndicators;
