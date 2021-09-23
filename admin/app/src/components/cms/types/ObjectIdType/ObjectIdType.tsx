import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import CodeIcon from '@material-ui/icons/Code';
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

export default function ObjectIdType({ item, ...rest }) {
  const classes = useStyles();

  return (
    <Box {...rest}>
      <Grid container>
        <Grid container item xs={6} alignItems={'center'}>
          <Box display={'flex'} alignItems={'center'}>
            <Tooltip title={'ObjectId field'}>
              <CodeIcon className={classes.icon} />
            </Tooltip>
            <Typography variant={'body2'} style={{ opacity: 0.4 }}>
              {item.placeholder}
            </Typography>
          </Box>
        </Grid>
        <Grid container item xs={6} alignItems={'center'} justify={'flex-end'}>
          <Box display={'flex'} alignItems={'center'}>
            <FieldIndicators item={item} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export function ObjectIdGroupType({ item, ...rest }) {
  const classes = useStyles();

  return (
    <Box {...rest}>
      <Grid container>
        <Grid container item xs={6} alignItems={'center'}>
          <Box display={'flex'} alignItems={'center'}>
            <Tooltip title={'ObjectId field'}>
              <CodeIcon className={classes.icon} />
            </Tooltip>
            <Typography variant={'body2'} style={{ opacity: 0.4 }}>
              {item.placeholder}
            </Typography>
          </Box>
        </Grid>
        <Grid container item xs={6} alignItems={'center'} justify={'flex-end'}>
          <Box display={'flex'} alignItems={'center'}>
            <FieldIndicators item={item} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
