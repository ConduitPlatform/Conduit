import React, { FC, useState } from 'react';
import { Box, MenuItem, Switch, TextField } from '@material-ui/core';
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
  selectRoot: {
    '& .MuiSelect-root': {
      padding: theme.spacing(1, 2),
      paddingRight: theme.spacing(4),
    },
  },
  createTitle: {
    marginRight: theme.spacing(1),
  },
  input: {
    marginBottom: theme.spacing(1),
  },
  switch: {
    display: 'flex',
    alignItems: 'center',
  },
}));

enum Selected {
  folder = 'folder',
  container = 'folder',
}

interface InputData {
  container: {
    name: string;
    isPublic: boolean;
  };
  folder: {
    name: string;
    container: string;
    isPublic: boolean;
  };
}

interface Props {
  open: boolean;
  closeDrawer: () => void;
}

const StorageCreateDrawer: FC<Props> = ({ open, closeDrawer }) => {
  const classes = useStyles();

  const [selected, setSelected] = useState<Selected>(Selected.folder);

  const [inputData, setInputData] = useState<InputData>({
    container: {
      name: '',
      isPublic: false,
    },
    folder: {
      name: '',
      container: '',
      isPublic: false,
    },
  });

  return (
    <DrawerWrapper open={open} closeDrawer={() => closeDrawer()} width={250}>
      <Box className={classes.root}>
        <Box className={classes.createContainer}>
          <Typography variant="h6" className={classes.createTitle}>
            Create
          </Typography>
          <TextField
            select
            label=""
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value as Selected);
            }}
            variant="outlined"
            style={{ padding: 0 }}
            classes={{
              root: classes.selectRoot,
            }}>
            <MenuItem value="folder">Folder</MenuItem>
            <MenuItem value="container">Container</MenuItem>
          </TextField>
        </Box>
        <TextField
          variant="outlined"
          label="Name"
          className={classes.input}
          value={inputData[selected].name}
          onChange={(event) => {
            setInputData({
              ...inputData,
              [selected]: {
                ...inputData[selected],
                name: event.target.value,
              },
            });
          }}
        />
        {selected === Selected.container && (
          <TextField
            variant="outlined"
            label="Container"
            className={classes.input}
            value={inputData[selected].container}
            onChange={(event) => {
              setInputData({
                ...inputData,
                [selected]: {
                  ...inputData[selected],
                  container: event.target.value,
                },
              });
            }}
          />
        )}
        <Box className={classes.switch}>
          <Typography variant="subtitle1">Is Public</Typography>
          <Switch
            color="primary"
            value={inputData[selected].isPublic}
            onChange={(event) => {
              setInputData({
                ...inputData,
                [selected]: {
                  ...inputData[selected],
                  isPublic: event.target.checked,
                },
              });
            }}
          />
        </Box>
      </Box>
    </DrawerWrapper>
  );
};

export default StorageCreateDrawer;
