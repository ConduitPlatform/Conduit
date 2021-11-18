import React, { FC, useState } from 'react';
import Box from '@material-ui/core/Box';
import { BoxProps } from '@material-ui/core/Box/Box';
import { makeStyles } from '@material-ui/core/styles';
import { IChatRoom } from '../../models/chat/ChatModels';
import { asyncDeleteChatMessages } from '../../redux/slices/chatSlice';
import { useAppDispatch } from '../../redux/store';
import { IconButton, Paper, Typography } from '@material-ui/core';
import { InfoOutlined } from '@material-ui/icons';
import DeleteIcon from '@material-ui/icons/Delete';
import ChatInfoDialog from './ChatInfoDialog';
import ConfirmationDialog from '../common/ConfirmationDialog';
import ChatRoomMessages from './ChatRoomMessages';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    padding: theme.spacing(2, 0, 2, 2),
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
    zIndex: 1,
  },
}));

interface Props extends BoxProps {
  panelData: IChatRoom;
  selectedPanel: number;
}

const ChatRoomPanel: FC<Props> = ({ panelData, selectedPanel }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const [infoDialog, setInfoDialog] = useState<boolean>(false);
  const [deleteDialog, setDeleteDialog] = useState<boolean>(false);
  const [selected, setSelected] = useState<string[]>([]);

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
            <Typography>{selected.length}selected</Typography>
          </Box>
        )}
      </Paper>
      <Box className={classes.contentContainer}>
        <ChatRoomMessages
          roomId={panelData._id}
          selectedPanel={selectedPanel}
          selectedMessages={selected}
          onPress={onPress}
          onLongPress={onLongPress}
        />
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
