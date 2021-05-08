import { Box, Typography } from '@material-ui/core';
import React from 'react';

const TreeItemContent = ({ node, field, operator, value, handleEdit }) => {
  return node ? (
    <Box
      width={150}
      display={'flex'}
      alignItems={'center'}
      justifyContent={'space-between'}>
      <Typography component={'span'} variant={'h5'}>
        {'"'}
        {operator}
        {'"'}
      </Typography>
    </Box>
  ) : (
    <Box>
      <Typography component={'span'} variant={'body1'}>
        {field}{' '}
      </Typography>
      <Typography component={'span'} variant={'body1'}>
        {operator}{' '}
      </Typography>
      <Typography component={'span'} variant={'body1'}>
        {value}{' '}
      </Typography>
    </Box>
  );
};

export default TreeItemContent;
