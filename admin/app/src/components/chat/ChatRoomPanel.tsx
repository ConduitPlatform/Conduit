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
import clsx from 'clsx';

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
    position: 'relative',
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
    marginBottom: theme.spacing(0.5),
    padding: theme.spacing(2, 1),
    borderRadius: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
  },
  bubbleSelected: {
    backgroundColor: `${theme.palette.grey[700]}80`,
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
  selectedContainer: {
    backgroundColor: theme.palette.grey[600],
    borderRadius: theme.spacing(3),
    padding: theme.spacing(1, 2),
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
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
  const [selected, setSelected] = useState<string[]>([]);

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

  const onLongPress = (id: string) => {
    if (selected.includes(id)) return;
    const newSelected = [...selected, id];
    setSelected(newSelected);
  };

  const onPress = (id: string) => {
    if (selected.length < 1) return;
    const newSelected = [...selected];
    if (selected.includes(id)) {
      const itemIndex = selected.findIndex((selectedId) => selectedId === id);
      newSelected.splice(itemIndex, 1);
    } else {
      newSelected.push(id);
    }
    setSelected(newSelected);
  };

  return (
    <Box className={classes.root}>
      <Paper className={classes.infoContainer} elevation={6}>
        <Typography>{panelData.name}</Typography>
        <Box className={classes.actionContainer}>
          <IconButton className={classes.actionButton}>
            <DeleteIcon />
          </IconButton>
          <IconButton className={classes.actionButton} onClick={() => handleOpenModal()}>
            <InfoOutlined />
          </IconButton>
        </Box>
      </Paper>
      <Box className={classes.contentContainer} {...rest}>
        {selected.length > 0 && (
          <Box className={classes.selectedContainer}>
            <Typography>{selected.length} selected</Typography>
          </Box>
        )}
        {data.map((item, index) => {
          if (index === data.length - 1) {
            return (
              <div ref={lastMessageElementRef} key={index}>
                <ChatRoomBubble
                  data={item}
                  className={
                    selected.includes(item._id)
                      ? clsx(classes.bubble, classes.bubbleSelected)
                      : classes.bubble
                  }
                  onLongPress={onLongPress}
                  onPress={onPress}
                />
              </div>
            );
          }
          return (
            <ChatRoomBubble
              data={item}
              className={
                selected.includes(item._id)
                  ? clsx(classes.bubble, classes.bubbleSelected)
                  : classes.bubble
              }
              onLongPress={onLongPress}
              onPress={onPress}
              key={index}
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
