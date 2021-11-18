import { Dialog, DialogContent, DialogTitle, Typography } from '@material-ui/core';
import moment from 'moment';
import Box from '@material-ui/core/Box';
import React, { FC } from 'react';
import { IChatRoom } from '../../models/chat/ChatModels';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  dialogInfo: {
    marginBottom: theme.spacing(1),
  },
}));

interface Props {
  data: IChatRoom;
  open: boolean;
  onClose: () => void;
}

const ChatInfoDialog: FC<Props> = ({ data, open, onClose }) => {
  const classes = useStyles();
  return (
    <Dialog onClose={onClose} open={open} fullWidth maxWidth="xs">
      <DialogTitle>Info</DialogTitle>
      <DialogContent>
        <Typography variant="body1" className={classes.dialogInfo}>
          id: {data._id}
        </Typography>
        <Typography variant="body1" className={classes.dialogInfo}>
          Name: {data.name}
        </Typography>
        <Typography variant="body1" className={classes.dialogInfo}>
          Created at: {moment(data.createdAt).format('MMM Do YYYY, h:mm:ss a')}
        </Typography>
        <Box>
          <Typography variant="body1">Participants:</Typography>
          {data.participants.map((participant, index) => {
            return (
              <Typography variant={'body2'} key={index}>
                {participant.email}
              </Typography>
            );
          })}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ChatInfoDialog;
