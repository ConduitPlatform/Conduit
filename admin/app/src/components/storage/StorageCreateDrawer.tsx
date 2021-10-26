import React, { FC, useState } from 'react';
import { Box, Button, MenuItem, Switch, TextField } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import DrawerWrapper from '../navigation/SideDrawerWrapper';
import { makeStyles } from '@material-ui/core/styles';
import { IContainer } from '../../models/storage/StorageModels';
import { useAppDispatch } from '../../redux/store';
import { asyncAddStorageContainer, asyncAddStorageFolder } from '../../redux/slices/storageSlice';

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
    marginBottom: theme.spacing(2),
  },
  saveButton: {
    marginRight: theme.spacing(1),
  },
}));

enum Selected {
  folder = 'folder',
  container = 'container',
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
  containers: IContainer[];
}

const StorageCreateDrawer: FC<Props> = ({ open, closeDrawer, containers }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const [selected, setSelected] = useState<Selected>(Selected.container);

  const initialInputData = {
    container: {
      name: '',
      isPublic: false,
    },
    folder: {
      name: '',
      container: '',
      isPublic: false,
    },
  };
  const [inputData, setInputData] = useState<InputData>(initialInputData);

  const handleCancel = () => {
    setInputData(initialInputData);
    closeDrawer();
  };

  const handleSave = () => {
    if (selected === Selected.container) {
      dispatch(asyncAddStorageContainer(inputData.container));
      closeDrawer();
      return;
    }
    dispatch(asyncAddStorageFolder(inputData.folder));
    closeDrawer();
  };

  return (
    <DrawerWrapper open={open} closeDrawer={() => closeDrawer()} width={256}>
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
            <MenuItem value="container">Container</MenuItem>
            <MenuItem value="folder">Folder</MenuItem>
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
        {selected === Selected.folder && (
          <TextField
            select
            label="Container"
            className={classes.input}
            value={inputData.folder.container}
            onChange={(event) => {
              setInputData({
                ...inputData,
                folder: {
                  ...inputData.folder,
                  container: event.target.value,
                },
              });
            }}
            variant="outlined">
            {containers.map((container, index) => (
              <MenuItem value={container.name} key={index}>
                {container.name}
              </MenuItem>
            ))}
          </TextField>
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

export default StorageCreateDrawer;
