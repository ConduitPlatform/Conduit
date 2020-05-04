import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import TextIcon from '@material-ui/icons/Title';
import NumberIcon from '@material-ui/icons/Filter7';
import DateIcon from '@material-ui/icons/DateRange';
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';
import FieldIndicators from '../../FieldIndicators';
import Grid from '@material-ui/core/Grid';

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

const handleIcon = (item) => {
  const classes = useStyles();

  switch (item) {
    case 'Text':
      return (
        <Tooltip title={'Text field'}>
          <TextIcon className={classes.icon} />
        </Tooltip>
      );
    case 'Number':
      return (
        <Tooltip title={'Number field'}>
          <NumberIcon className={classes.icon} />
        </Tooltip>
      );
    case 'Date':
      return (
        <Tooltip title={'Date field'}>
          <DateIcon className={classes.icon} />
        </Tooltip>
      );
    default:
      return null;
  }
};

export default function SimpleType(props) {
  const { item, ...rest } = props;

  return (
    <Box {...rest}>
      <Grid container>
        <Grid item xs={6}>
          <Box display={'flex'} alignItems={'center'}>
            {handleIcon(item.type)}
            <Typography variant={'body2'} style={{ opacity: 0.4 }}>
              {item.placeholder}
            </Typography>
          </Box>
        </Grid>
        <Grid container item xs={6} justify={'flex-end'} alignItems={'center'}>
          <Box display={'flex'} alignItems={'center'}>
            <FieldIndicators item={item} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export function SimpleGroupType(props) {
  const { item, ...rest } = props;

  return (
    <Box {...rest}>
      <Grid container>
        <Grid item xs={6}>
          <Box display={'flex'} alignItems={'center'}>
            {handleIcon(item.type)}
            <Typography variant={'body2'} style={{ opacity: 0.4 }}>
              {item.placeholder}
            </Typography>
          </Box>
        </Grid>
        <Grid container item xs={6} justify={'flex-end'} alignItems={'center'}>
          <Box display={'flex'} alignItems={'center'}>
            <FieldIndicators item={item} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
