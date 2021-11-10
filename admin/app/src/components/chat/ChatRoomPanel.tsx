import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import Box from '@material-ui/core/Box';
import { BoxProps } from '@material-ui/core/Box/Box';
import { makeStyles } from '@material-ui/core/styles';
import ChatRoomBubble from './ChatRoomBubble';
import { IChatMessage, IChatRoom } from '../../models/chat/ChatModels';
import {
  addChatMessagesSkip,
  asyncDeleteChatMessages,
  asyncGetChatMessages,
} from '../../redux/slices/chatSlice';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { IconButton, Paper, Typography } from '@material-ui/core';
import { InfoOutlined } from '@material-ui/icons';
import DeleteIcon from '@material-ui/icons/Delete';
import clsx from 'clsx';
import ChatInfoDialog from './ChatInfoDialog';
import ConfirmationDialog from '../common/ConfirmationDialog';

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
    position: 'relative',
  },
  infoButton: {
    cursor: 'pointer',
  },
  bubble: {
    marginBottom: theme.spacing(0.5),
    padding: theme.spacing(1, 1),
    borderRadius: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
  },
  bubbleSelected: {
    backgroundColor: `${theme.palette.grey[700]}80`,
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
    top: theme.spacing(8),
    right: theme.spacing(2.5),
  },
}));

interface Props extends BoxProps {
  panelData: IChatRoom;
}

const ChatRoomPanel: FC<Props> = ({ panelData, ...rest }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();
  const {
    chatMessages: { data, skip, hasMore, loading },
  } = useAppSelector((state) => state.chatSlice.data);

  const [infoDialog, setInfoDialog] = useState<boolean>(false);
  const [deleteDialog, setDeleteDialog] = useState<boolean>(false);
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

  const onDeletePress = () => {
    setDeleteDialog(true);
  };

  const handleDelete = () => {
    dispatch(asyncDeleteChatMessages({ ids: selected }));
    setDeleteDialog(false);
    setSelected([]);
  };

  const handleClose = () => {
    setDeleteDialog(false);
  };

  const getChatBubble = (item: IChatMessage, index?: number) => {
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
  };

  return (
    <Box className={classes.root}>
      <Paper className={classes.infoContainer} elevation={6}>
        <Typography>{panelData.name}</Typography>
        <Box className={classes.actionContainer}>
          {selected.length > 0 && (
            <IconButton className={classes.actionButton} onClick={() => onDeletePress()}>
              <DeleteIcon />
            </IconButton>
          )}
          <IconButton className={classes.actionButton} onClick={() => handleOpenModal()}>
            <InfoOutlined />
          </IconButton>
        </Box>
        {selected.length > 0 && (
          <Box className={classes.selectedContainer}>
            <Typography>{selected.length} selected</Typography>
          </Box>
        )}
      </Paper>
      <Box className={classes.contentContainer} {...rest}>
        {data.map((item, index) => {
          if (index === data.length - 1) {
            return (
              <div ref={lastMessageElementRef} key={index}>
                {getChatBubble(item)}
              </div>
            );
          }
          return getChatBubble(item, index);
        })}
      </Box>
      <ChatInfoDialog data={panelData} open={infoDialog} onClose={handleCloseModal} />
      <ConfirmationDialog
        open={deleteDialog}
        handleClose={handleClose}
        title="Delete messages"
        description="Are you sure you want to delete the selected messages?"
        buttonAction={handleDelete}
        buttonText={'Delete'}
      />
    </Box>
  );
};

export default ChatRoomPanel;
