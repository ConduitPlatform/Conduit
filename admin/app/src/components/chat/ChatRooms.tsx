import React, { useEffect, useState } from 'react';
import { Box, Button, Paper } from '@material-ui/core';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch } from '../../redux/store';
import { asyncGetChatRooms } from '../../redux/slices/chatSlice';
import ChatRoomPanel from './ChatRoomPanel';
import AddCircleOutline from '@material-ui/icons/AddCircleOutline';
import CreateChatRoomDrawer from './CreateChatRoomDrawer';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flex: 1,
  },
  topContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
  },
  tabs: {
    minWidth: theme.spacing(25),
  },
}));

const chatRoomPanelData = [
  { name: 'chatRoom 1' },
  { name: 'chatRoom 2' },
  { name: 'chatRoom 3' },
  { name: 'chatRoom 4' },
  { name: 'chatRoom 5' },
];

const participants = [
  'Oliver Hansen',
  'Van Henry',
  'April Tucker',
  'Ralph Hubbard',
  'Omar Alexander',
  'Carlos Abbott',
  'Miriam Wagner',
  'Bradley Wilkerson',
  'Virginia Andrews',
  'Kelly Snyder',
];

const ChatRooms: React.FC = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const [selected, setSelected] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    const params = { skip: 0, limit: 10 };
    dispatch(asyncGetChatRooms(params));
  }, [dispatch]);

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setSelected(newValue);
  };

  const onCreateChatRoom = () => {
    setDrawerOpen(true);
  };

  const handleCreateChatRoom = () => {
    setDrawerOpen(false);
  };

  const onCloseDrawer = () => {
    setDrawerOpen(false);
  };

  return (
    <>
      <Box className={classes.topContainer}>
        <Box />
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutline />}
          onClick={() => onCreateChatRoom()}>
          Create chat room
        </Button>
      </Box>
      <Paper className={classes.root}>
        <Tabs
          orientation="vertical"
          variant="scrollable"
          value={selected}
          onChange={handleChange}
          className={classes.tabs}>
          {chatRoomPanelData.map((item, index) => {
            return <Tab label={item.name} key={index} />;
          })}
        </Tabs>
        {chatRoomPanelData.map((item, index) => {
          if (index === selected) {
            return <ChatRoomPanel name={item.name} key={index} />;
          }
        })}
      </Paper>
      <CreateChatRoomDrawer
        open={drawerOpen}
        data={participants}
        handleCreateChatRoom={handleCreateChatRoom}
        closeDrawer={onCloseDrawer}
      />
    </>
  );
};

export default ChatRooms;
