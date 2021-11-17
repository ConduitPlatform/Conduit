import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Paper, TextField } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import {
  asyncGetChatRooms,
  asyncPostCreateChatRoom,
  clearChatMessages,
} from '../../redux/slices/chatSlice';
import ChatRoomPanel from './ChatRoomPanel';
import AddCircleOutline from '@material-ui/icons/AddCircleOutline';
import CreateChatRoomDrawer from './CreateChatRoomDrawer';
import useDebounce from '../../hooks/useDebounce';
import ChatRoomTabs from './ChatRoomTabs';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    height: '75vh',
    padding: theme.spacing(1),
  },
  innerRoot: {
    display: 'flex',
    flexDirection: 'column',
    width: theme.spacing(30),
  },
  topContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
  },
  search: {
    marginBottom: theme.spacing(1),
  },
  tabContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
}));

const ChatRooms: React.FC = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const {
    chatRooms: { data, count },
  } = useAppSelector((state) => state.chatSlice.data);

  const [selected, setSelected] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');

  const debouncedSearch: string = useDebounce(search, 500);

  const getChatRooms = useCallback(() => {
    const params = { skip: 0, limit: 10, search: debouncedSearch };
    dispatch(asyncGetChatRooms(params));
  }, [debouncedSearch, dispatch]);

  useEffect(() => {
    getChatRooms();
  }, [getChatRooms]);

  const handleCreateChatRoom = (inputData: { name: string; participants: string[] }) => {
    const params = {
      ...inputData,
      getChatRooms: getChatRooms,
    };
    dispatch(asyncPostCreateChatRoom(params));
    setDrawerOpen(false);
  };

  const onPress = (index: number) => {
    if (index === selected) return;
    setSelected(index);
    dispatch(clearChatMessages());
  };

  const onLongPress = (index: number) => {
    console.log('onLongPress', index);
  };

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
        <Box className={classes.innerRoot}>
          <TextField
            className={classes.search}
            label={'Search'}
            variant={'outlined'}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
          <Box className={classes.tabContainer}>
            <ChatRoomTabs
              chatRooms={data}
              chatRoomCount={count}
              onPress={onPress}
              onLongPress={onLongPress}
              selectedTab={selected}
              debouncedSearch={debouncedSearch}
            />
          </Box>
        </Box>
        {data.map((item, index) => {
          if (index === selected) {
            return <ChatRoomPanel panelData={item} key={index} selectedPanel={selected} />;
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
