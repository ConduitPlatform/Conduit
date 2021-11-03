import React, { useEffect, useState } from 'react';
import { Paper } from '@material-ui/core';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch } from '../../redux/store';
import { asyncGetChatRooms } from '../../redux/slices/chatSlice';
import ChatRoomPanel from './ChatRoomPanel';

const useStyles = makeStyles(() => ({
  root: {
    display: 'flex',
    height: '100%',
  },
}));

const chatRoomPanelData = [
  { name: 'chatRoom 1' },
  { name: 'chatRoom 2' },
  { name: 'chatRoom 3' },
  { name: 'chatRoom 4' },
  { name: 'chatRoom 5' },
];

const ChatRooms: React.FC = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const params = { skip: 0, limit: 10 };
    dispatch(asyncGetChatRooms(params));
  }, [dispatch]);

  const [selected, setSelected] = useState(0);

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setSelected(newValue);
  };

  return (
    <Paper className={classes.root}>
      <Tabs orientation="vertical" variant="scrollable" value={selected} onChange={handleChange}>
        <Tab label="Chatroom 1" />
        <Tab label="Chatroom 2" />
        <Tab label="Chatroom 3" />
        <Tab label="Chatroom 4" />
        <Tab label="Chatroom 5" />
      </Tabs>
      {chatRoomPanelData.map((item, index) => {
        if (index === selected) {
          return <ChatRoomPanel name={item.name} key={index} />;
        }
      })}
    </Paper>
  );
};

export default ChatRooms;
