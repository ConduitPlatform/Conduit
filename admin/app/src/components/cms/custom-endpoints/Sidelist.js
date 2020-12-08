import { Box, Button, Divider, List, ListItem, ListItemText } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import React from 'react';

const useStyles = makeStyles((theme) => ({
  listBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    borderRight: '1px solid #000000',
    height: '100%',
  },
  divider: {
    '&.MuiDivider-root': {
      height: '2px',
      background: '#000000',
      borderRadius: '4px',
    },
  },
  button: {
    margin: theme.spacing(1),
    textTransform: 'none',
  },
  list: {
    '&.MuiList-root': {
      maxHeight: '580px',
      overflowY: 'auto',
      width: '100%',
      //   '&::-webkit-scrollbar': {
      //     display: 'none',
      //   },
    },
  },
  listItem: {
    '&.MuiListItem-root:hover': {
      background: 'rgba(0, 83, 156, 0.2)',
      borderRadius: '4px',
    },
    '&.Mui-selected': {
      background: '#00539C',
      borderRadius: '4px',
      color: '#ffffff',
    },
    '&.Mui-selected:hover': {
      background: '#00539C',
      borderRadius: '4px',
      color: '#ffffff',
    },
  },
}));

const Sidelist = ({
  endpoints,
  selectedEndpoint,
  handleAddNewEndpoint,
  handleListItemSelect,
}) => {
  const classes = useStyles();

  return (
    <Box className={classes.listBox}>
      <Button
        variant="contained"
        color={'primary'}
        className={classes.button}
        endIcon={<AddCircleOutlineIcon />}
        onClick={handleAddNewEndpoint}>
        Add endpoint
      </Button>
      <Divider flexItem variant="middle" className={classes.divider}></Divider>
      <List className={classes.list}>
        {endpoints.map((endpoint) => (
          <ListItem
            button
            key={`endpoint-${endpoint._id}`}
            className={classes.listItem}
            onClick={() => handleListItemSelect(endpoint)}
            selected={selectedEndpoint?._id === endpoint?._id}>
            <ListItemText primary={endpoint.name} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default Sidelist;
