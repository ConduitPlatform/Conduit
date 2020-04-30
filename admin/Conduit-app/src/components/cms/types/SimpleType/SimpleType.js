import React from 'react';
import {makeStyles} from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import TextIcon from '@material-ui/icons/Title';
import NumberIcon from '@material-ui/icons/Filter7';
import DateIcon from '@material-ui/icons/DateRange';
import Typography from "@material-ui/core/Typography";

const useStyles = makeStyles(theme => ({
  icon: {
    height: theme.spacing(3),
    width: theme.spacing(3),
    marginRight: theme.spacing(1),
    opacity: 0.6
  }
}));

const handleIcon = (item) => {
  const classes = useStyles();
  switch (item) {
    case 'Text':
      return <TextIcon className={classes.icon}/>;
    case 'Number':
      return <NumberIcon className={classes.icon}/>;
    case 'Date':
      return <DateIcon className={classes.icon}/>;
    default:
      return null
  }
};

export default function SimpleType(props) {
  const {item, ...rest} = props;

  return (
    <Box {...rest}>
      <Box display={'flex'} alignItems={'center'}>
        {handleIcon(item.type)}
        <Typography variant={'body2'} style={{opacity: 0.4}}>{item.placeholder}</Typography>
      </Box>
    </Box>
  );
}

export function SimpleGroupType(props) {
  const {item, ...rest} = props;

  return (
    <Box {...rest}>
      <Box display={'flex'} alignItems={'center'}>
        {handleIcon(item.type)}
        <Typography variant={'body2'} style={{opacity: 0.4}}>{item.placeholder}</Typography>
      </Box>
    </Box>
  );
}
