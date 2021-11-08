import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import Box from '@material-ui/core/Box';
import { BoxProps } from '@material-ui/core/Box/Box';
import { makeStyles } from '@material-ui/core/styles';
import ChatRoomBubble from './ChatRoomBubble';
import { IChatRoom } from '../../models/chat/ChatModels';
import { addChatMessagesSkip, asyncGetChatMessages } from '../../redux/slices/chatSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Typography,
} from '@material-ui/core';
import { InfoOutlined } from '@material-ui/icons';
import moment from 'moment';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import useLongPress from '../../hooks/useLongPress';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: 'scroll',
  },
  infoContainer: {
    padding: theme.spacing(1, 2),
    backgroundColor: theme.palette.grey[600],
    marginLeft: theme.spacing(1),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoButton: {
    cursor: 'pointer',
  },
  bubble: {
    marginBottom: theme.spacing(2),
  },
  dialogInfo: {
    marginBottom: theme.spacing(1),
  },
  actionContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  actionButton: {
    padding: theme.spacing(1),
  },
}));

interface Props extends BoxProps {
  panelData: IChatRoom;
}

const ChatRoomPanel: FC<Props> = ({ panelData, ...rest }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();
  const {
    chatMessages: { data, skip, hasMore },
  } = useAppSelector((state) => state.chatSlice.data);
  const { loading } = useAppSelector((state) => state.chatSlice.data.chatMessages);

  const [infoDialog, setInfoDialog] = useState<boolean>(false);

  const observer = useRef<IntersectionObserver>();
  const lastMessageElementRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          dispatch(addChatMessagesSkip());
        }
      });
      if (node && observer.current) observer.current.observe(node);
    },
    [dispatch, hasMore, loading]
  );

  useEffect(() => {
    const params = {
      skip: skip,
      roomId: panelData._id,
    };
    dispatch(asyncGetChatMessages(params));
  }, [panelData._id, dispatch, skip]);

  const handleCloseModal = () => {
    setInfoDialog(false);
  };

  const handleOpenModal = () => {
    setInfoDialog(true);
  };

  const onLongPress = () => {
    console.log('long press');
  };

  const onPress = () => {
    console.log('press');
  };

  const defaultOptions = {
    shouldPreventDefault: false,
    delay: 500,
  };
  const longPressEvent = useLongPress(onLongPress, onPress, defaultOptions);

  console.log('longPressEvent', { ...longPressEvent });

  return (
    <Box className={classes.root}>
      <Paper className={classes.infoContainer} elevation={6}>
        <Typography>{panelData.name}</Typography>
        <Box className={classes.actionContainer}>
          <IconButton className={classes.actionButton} {...longPressEvent}>
            <EditIcon />
          </IconButton>
          <IconButton className={classes.actionButton}>
            <DeleteIcon />
          </IconButton>
          <IconButton className={classes.actionButton} onClick={() => handleOpenModal()}>
            <InfoOutlined />
          </IconButton>
        </Box>
      </Paper>
      <Box className={classes.contentContainer} {...rest}>
        {data.map((item, index) => {
          if (index === data.length - 1) {
            return (
              <div ref={lastMessageElementRef} key={index}>
                <ChatRoomBubble data={item} className={classes.bubble} {...longPressEvent} />
              </div>
            );
          }
          return (
            <ChatRoomBubble
              data={item}
              className={classes.bubble}
              key={index}
              {...longPressEvent}
            />
          );
        })}
      </Box>
      <Dialog onClose={handleCloseModal} open={infoDialog} fullWidth maxWidth="xs">
        <DialogTitle>Info</DialogTitle>
        <DialogContent>
          <Typography variant="body1" className={classes.dialogInfo}>
            id: {panelData._id}
          </Typography>
          <Typography variant="body1" className={classes.dialogInfo}>
            Name: {panelData.name}
          </Typography>
          <Typography variant="body1" className={classes.dialogInfo}>
            Created at: {moment(panelData.createdAt).format('MMM Do YYYY, h:mm:ss a')}
          </Typography>
          <Box>
            <Typography variant="body1">Participants:</Typography>
            {panelData.participants.map((participant, index) => {
              return (
                <Typography variant={'body2'} key={index}>
                  {participant.email}
                </Typography>
              );
            })}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default ChatRoomPanel;
