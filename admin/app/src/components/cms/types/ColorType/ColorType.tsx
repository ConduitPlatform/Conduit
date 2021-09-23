import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import ColorIcon from '@material-ui/icons/ColorLens';
import Typography from '@material-ui/core/Typography';
import ColorizeIcon from '@material-ui/icons/Colorize';

const useStyles = makeStyles((theme) => ({
  icon: {
    height: theme.spacing(3),
    width: theme.spacing(3),
    marginRight: theme.spacing(1),
    opacity: 0.6,
  },
}));

const ColorType = (props) => {
  const { item, ...rest } = props;
  const classes = useStyles();

  return (
    <Box {...rest}>
      <Box display={'flex'} alignItems={'center'}>
        <ColorIcon className={classes.icon} />
        <Typography variant={'body2'} style={{ opacity: 0.4 }}>
          #000000
        </Typography>
        <ColorizeIcon className={classes.icon} style={{ marginLeft: 8 }} />
      </Box>
    </Box>
  );
};

export default ColorType;

export const ColorGroupType = (props) => {
  const { item, ...rest } = props;
  const classes = useStyles();

  return (
    <Box {...rest}>
      <Box display={'flex'} alignItems={'center'}>
        <ColorIcon className={classes.icon} />
        <Typography variant={'body2'} style={{ opacity: 0.4 }}>
          #000000
        </Typography>
        <ColorizeIcon className={classes.icon} style={{ marginLeft: 8 }} />
      </Box>
    </Box>
  );
};
