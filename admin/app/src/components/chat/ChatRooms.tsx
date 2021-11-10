import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Paper, TextField } from '@material-ui/core';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import {
  addChatRoomsSkip,
  asyncGetChatRooms,
  asyncPostCreateChatRoom,
  clearChatMessages,
} from '../../redux/slices/chatSlice';
import ChatRoomPanel from './ChatRoomPanel';
import AddCircleOutline from '@material-ui/icons/AddCircleOutline';
import CreateChatRoomDrawer from './CreateChatRoomDrawer';
import useDebounce from '../../hooks/useDebounce';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    maxHeight: '75vh',
    padding: theme.spacing(1),
  },
  topContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
  },
  tabs: {
    minWidth: theme.spacing(25),
  },
  search: {
    marginBottom: theme.spacing(1),
  },
  tabContainer: {
    padding: theme.spacing(0, 1),
    display: 'flex',
    flexDirection: 'column',
  },
}));

const ChatRooms: React.FC = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const {
    chatRooms: { data, skip, hasMore, loading },
  } = useAppSelector((state) => state.chatSlice.data);

  const [selected, setSelected] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');

  const debouncedSearch: string = useDebounce(search, 500);

  const getChatRooms = useCallback(() => {
    const params = { skip: skip, search: debouncedSearch };
    dispatch(asyncGetChatRooms(params));
  }, [debouncedSearch, dispatch, skip]);

  useEffect(() => {
    getChatRooms();
  }, [getChatRooms]);

  const handleChange = (newValue: number) => {
    if (newValue === selected) return;
    setSelected(newValue);
    dispatch(clearChatMessages());
  };

  const handleCreateChatRoom = (inputData: { name: string; participants: string[] }) => {
    const params = {
      ...inputData,
      getChatRooms: getChatRooms,
    };
    dispatch(asyncPostCreateChatRoom(params));
    setDrawerOpen(false);
  };

  const observer = useRef<IntersectionObserver>();

  const lastChatRoomElementRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          dispatch(addChatRoomsSkip());
        }
      });
      if (node && observer.current) observer.current.observe(node);
    },
    [dispatch, hasMore, loading]
  );

  return (
    <>
      <Box className={classes.topContainer}>
        <Box />
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutline />}
          onClick={() => setDrawerOpen(true)}>
          Create chat room
        </Button>
      </Box>
      <Paper className={classes.root}>
        <Box className={classes.tabContainer}>
          <TextField
            className={classes.search}
            label={'Search'}
            variant={'outlined'}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
          <Tabs
            scrollButtons="off"
            orientation="vertical"
            variant="scrollable"
            value={selected}
            onChange={(event, value) => handleChange(value)}
            className={classes.tabs}>
            {data.map((item, index) => {
              if (index === data.length - 1) {
                return (
                  // <div  key={index}>
                  <Tab label={item.name} ref={lastChatRoomElementRef} key={index} />
                  // </div>
                );
              }
              return <Tab label={item.name} key={index} />;
            })}
          </Tabs>
        </Box>
        {data.map((item, index) => {
          if (index === selected) {
            return <ChatRoomPanel panelData={item} key={index} />;
          }
        })}
      </Paper>
      <CreateChatRoomDrawer
        open={drawerOpen}
        handleCreateChatRoom={handleCreateChatRoom}
        closeDrawer={() => setDrawerOpen(false)}
      />
    </>
  );
};

export default ChatRooms;
