import React, { FC } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { BoxProps } from '@material-ui/core/Box/Box';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
  },
  contentContainer: {
    backgroundColor: 'grey',
    borderRadius: theme.spacing(2),
    padding: theme.spacing(1, 2),
    maxWidth: '80%',
  },
  iconContainer: {
    height: theme.spacing(4),
    width: theme.spacing(4),
    borderRadius: '50%',
    backgroundColor: 'purple',
    marginRight: theme.spacing(1),
  },
}));

const ChatRoomBubble: FC = ({ ...rest }) => {
  const classes = useStyles();
  return (
    <Box className={classes.root} {...rest}>
      <Box className={classes.iconContainer} />
      <Box className={classes.contentContainer}>
        <Typography variant="body2">
          {`There are many variations of passages of Lorem Ipsum available, but the majority have
          suffered alteration in some form, by injected humour, or randomised words which don't look
          even slightly believable.`}
        </Typography>
      </Box>
    </Box>
  );
};

export default ChatRoomBubble;
