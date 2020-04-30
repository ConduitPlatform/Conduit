import React from 'react';
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Switch from "@material-ui/core/Switch";

export default function BooleanType(props) {
  const {item, ...rest} = props;

  return (
    <Box {...rest}>
      <Box display={'flex'} alignItems={'center'}>
        <Typography variant={'body2'} style={{opacity: 0.4}}>{item.placeholderFalse}</Typography>
        <Switch disabled checked value="Boolean"/>
        <Typography variant={'body2'} style={{opacity: 0.4}}>{item.placeholderTrue}</Typography>
      </Box>
    </Box>
  );
}

export function BooleanGroupType(props) {
  const {item, ...rest} = props;

  return (
    <Box {...rest}>
      <Box display={'flex'} alignItems={'center'}>
        <Typography variant={'body2'} style={{opacity: 0.4}}>{item.placeholderFalse}</Typography>
        <Switch disabled checked value="Boolean"/>
        <Typography variant={'body2'} style={{opacity: 0.4}}>{item.placeholderTrue}</Typography>
      </Box>
    </Box>
  );
}
