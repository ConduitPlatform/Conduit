import React, { FC, useState } from 'react';
import { Box, Button, MenuItem, TextField } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import DrawerWrapper from '../navigation/SideDrawerWrapper';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(6),
  },
  createContainer: {
    display: 'flex',
    alignItems: 'center',
    textAlign: 'start',
    marginBottom: theme.spacing(2),
  },
  createTitle: {
    marginRight: theme.spacing(1),
  },
  input: {
    marginBottom: theme.spacing(2),
  },
  saveButton: {
    marginRight: theme.spacing(1),
  },
}));

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  getContentAnchorEl: null,
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 8 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

interface ICreateChatRoom {
  name: string;
  participants: string[];
}

interface Props {
  open: boolean;
  data: string[];
  handleCreateChatRoom: (data: ICreateChatRoom) => void;
  closeDrawer: () => void;
}

const CreateChatRoomDrawer: FC<Props> = ({ open, data, handleCreateChatRoom, closeDrawer }) => {
  const classes = useStyles();

  const initialInputData = {
    name: '',
    participants: [],
  };
  const [inputData, setInputData] = useState<ICreateChatRoom>(initialInputData);

  const handleCancel = () => {
    setInputData(initialInputData);
    closeDrawer();
  };

  const handleSave = () => {
    handleCreateChatRoom(inputData);
    setInputData(initialInputData);
    closeDrawer();
  };

  const handleParticipantsChange = (value: unknown) => {
    setInputData({
      ...inputData,
      participants: value as string[],
    });
  };

  return (
    <DrawerWrapper open={open} closeDrawer={() => closeDrawer()} width={256}>
      <Box className={classes.root}>
        <Box className={classes.createContainer}>
          <Typography variant="h6" className={classes.createTitle}>
            Create chat room
          </Typography>
        </Box>
        <TextField
          variant="outlined"
          label="Name"
          className={classes.input}
          value={inputData.name}
          onChange={(event) => {
            setInputData({
              ...inputData,
              name: event.target.value,
            });
          }}
        />
        <TextField
          select
          SelectProps={{
            multiple: true,
            MenuProps: MenuProps,
          }}
          label="Participants"
          className={classes.input}
          value={inputData.participants}
          onChange={(event) => handleParticipantsChange(event.target.value)}
          variant="outlined">
          {data.map((participant, index) => (
            <MenuItem value={participant} key={index}>
              {participant}
            </MenuItem>
          ))}
        </TextField>
        <Box>
          <Button
            variant="contained"
            color="primary"
            className={classes.saveButton}
            onClick={() => handleSave()}>
            Save
          </Button>
          <Button variant="outlined" onClick={() => handleCancel()}>
            Cancel
          </Button>
        </Box>
      </Box>
    </DrawerWrapper>
  );
};

export default CreateChatRoomDrawer;
