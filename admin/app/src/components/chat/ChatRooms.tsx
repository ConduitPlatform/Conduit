import React, { useEffect, useState } from 'react';
import { Box, Button, Paper, TextField } from '@material-ui/core';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import { makeStyles } from '@material-ui/core/styles';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { asyncGetChatRooms, clearChatMessages } from '../../redux/slices/chatSlice';
import ChatRoomPanel from './ChatRoomPanel';
import AddCircleOutline from '@material-ui/icons/AddCircleOutline';
import CreateChatRoomDrawer from './CreateChatRoomDrawer';
import useDebounce from '../../hooks/useDebounce';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    maxHeight: '75vh',
    overflow: 'hidden',
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
  },
}));

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

  const {
    chatRooms: { data },
  } = useAppSelector((state) => state.chatSlice.data);

  const [selected, setSelected] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');

  const debouncedSearch: string = useDebounce(search, 500);

  useEffect(() => {
    const params = { skip: 0, limit: 10, search: debouncedSearch };
    dispatch(asyncGetChatRooms(params));
  }, [debouncedSearch, dispatch]);

  const handleChange = (newValue: number) => {
    setSelected(newValue);
    dispatch(clearChatMessages());
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
            orientation="vertical"
            variant="scrollable"
            value={selected}
            onChange={(event, value) => handleChange(value)}
            className={classes.tabs}>
            {data.map((item, index) => {
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
        data={participants}
        handleCreateChatRoom={handleCreateChatRoom}
        closeDrawer={onCloseDrawer}
      />
    </>
  );
};

export default ChatRooms;
