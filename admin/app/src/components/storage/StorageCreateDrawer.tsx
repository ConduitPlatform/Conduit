import React, { FC, useEffect, useState } from 'react';
import { Box, Button, MenuItem, Switch, TextField } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import DrawerWrapper from '../navigation/SideDrawerWrapper';
import { makeStyles } from '@material-ui/core/styles';
import { CreateFormSelected, IContainer, ICreateForm } from '../../models/storage/StorageModels';

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

interface Props {
  data: { open: boolean; type: CreateFormSelected };
  closeDrawer: () => void;
  containers: IContainer[];
  handleCreateFolder: (data: ICreateForm['folder']) => void;
  handleCreateContainer: (data: ICreateForm['container']) => void;
  path: string[];
}

const StorageCreateDrawer: FC<Props> = ({
  data,
  closeDrawer,
  containers,
  handleCreateFolder,
  handleCreateContainer,
  path,
}) => {
  const classes = useStyles();

  const initialInputData = {
    container: {
      name: '',
      isPublic: false,
    },
    folder: {
      name: '',
      container: path[0],
      isPublic: false,
    },
  };
  const [inputData, setInputData] = useState<ICreateForm>(initialInputData);

  const setInitialInputData = () => {
    setInputData((prevState) => {
      return {
        ...prevState,
        folder: {
          ...prevState.folder,
          name: '',
          isPublic: false,
        },
        container: {
          ...prevState.container,
          name: '',
          isPublic: false,
        },
      };
    });
  };

  useEffect(() => {
    setInputData((prevState) => {
      return {
        ...prevState,
        folder: {
          ...prevState.folder,
          container: path[0],
        },
      };
    });
  }, [path]);

  const handleCancel = () => {
    setInitialInputData();
    closeDrawer();
  };

  const handleSave = () => {
    if (data.type === CreateFormSelected.container) {
      handleCreateContainer(inputData.container);
      setInitialInputData();
      closeDrawer();
      return;
    }
    const folderData = {
      name: `${inputData.folder.name}/`,
      container: inputData.folder.container,
      isPublic: inputData.folder.isPublic,
    };
    handleCreateFolder(folderData);
    setInitialInputData();
    closeDrawer();
  };

  return (
    <DrawerWrapper open={data.open} closeDrawer={() => closeDrawer()} width={256}>
      <Box className={classes.root}>
        <Box className={classes.createContainer}>
          <Typography variant="h6" className={classes.createTitle}>
            Create {data.type}
          </Typography>
        </Box>
        <TextField
          variant="outlined"
          label="Name"
          className={classes.input}
          value={inputData[data.type].name}
          onChange={(event) => {
            setInputData({
              ...inputData,
              [data.type]: {
                ...inputData[data.type],
                name: event.target.value,
              },
            });
          }}
        />
        {data.type === CreateFormSelected.folder && (
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
            value={inputData[data.type].isPublic}
            onChange={(event) => {
              setInputData({
                ...inputData,
                [data.type]: {
                  ...inputData[data.type],
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
