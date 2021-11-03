import React, { FC } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { BoxProps } from '@material-ui/core/Box/Box';

interface Props extends BoxProps {
  name: string;
}

const ChatRoomPanel: FC<Props> = ({ name, ...rest }) => {
  return (
    <Box {...rest}>
      <Typography>{name}</Typography>
    </Box>
  );
};

export default ChatRoomPanel;
