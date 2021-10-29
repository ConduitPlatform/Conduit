import React, { FC, useEffect, useState } from 'react';
import { Box, Button, MenuItem, Switch, TextField } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import DrawerWrapper from '../navigation/SideDrawerWrapper';
import { makeStyles } from '@material-ui/core/styles';
import Dropzone from '../common/Dropzone';
import { IContainer, IStorageFile } from '../../models/storage/StorageModels';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(6),
  },
  title: {
    marginBottom: theme.spacing(1),
  },
  input: {
    marginTop: theme.spacing(2),
  },
  switch: {
    display: 'flex',
    alignItems: 'center',
    marginTop: theme.spacing(2),
  },
  buttonContainer: {
    marginTop: theme.spacing(2),
  },
  saveButton: {
    marginRight: theme.spacing(1),
  },
}));

interface Props {
  open: boolean;
  closeDrawer: () => void;
  containers: IContainer[];
  handleAddFile: (data: IStorageFile) => void;
  path: string;
}

const StorageAddDrawer: FC<Props> = ({ open, closeDrawer, containers, handleAddFile, path }) => {
  const classes = useStyles();
  // const dispatch = useAppDispatch();
  // const { selectedFile } = useAppSelector((state) => state.storageSlice.data);
  // console.log('selectedFile', selectedFile);

  const initialFileData = {
    name: '',
    data: '',
    folder: '',
    container: '',
    isPublic: false,
    mimeType: '',
  };
  const [fileData, setFileData] = useState<IStorageFile>(initialFileData);

  useEffect(() => {
    const splitPath = path.split('/');
    const filteredSplitPath = splitPath.filter((item) => {
      return item !== '';
    });
    if (filteredSplitPath.length < 1) return;
    if (filteredSplitPath.length > 1) {
      setFileData((prevState) => {
        return {
          ...prevState,
          folder: filteredSplitPath[filteredSplitPath.length - 1],
        };
      });
    }
    setFileData((prevState) => {
      return {
        ...prevState,
        container: filteredSplitPath[0],
      };
    });
  }, [path]);

  const handleCancel = () => {
    closeDrawer();
    setFileData(initialFileData);
  };

  const handleAdd = () => {
    closeDrawer();
    const sendFileData = {
      name: fileData.name,
      data: fileData.data,
      folder: fileData.folder ? `${fileData.folder}/` : undefined,
      container: fileData.container,
      isPublic: fileData.isPublic,
      mimeType: fileData.mimeType,
    };
    setFileData(initialFileData);
    handleAddFile(sendFileData);
  };

  const handleSetFile = (data: string, mimeType: string, name: string) => {
    setFileData({
      ...fileData,
      data: data,
      mimeType: mimeType,
      name: fileData.name ? fileData.name : name,
    });
  };

  return (
    <DrawerWrapper open={open} closeDrawer={() => closeDrawer()} width={512}>
      <Box className={classes.root}>
        <Typography variant="h6" className={classes.title}>
          Add File
        </Typography>
        <Dropzone file={fileData.data} setFile={handleSetFile} />
        <TextField
          variant="outlined"
          label="File Name"
          className={classes.input}
          value={fileData.name}
          onChange={(event) => {
            setFileData({
              ...fileData,
              name: event.target.value,
            });
          }}
        />
        <TextField
          select
          label="Container"
          className={classes.input}
          value={fileData.container}
          onChange={(event) => {
            setFileData({
              ...fileData,
              container: event.target.value,
            });
          }}
          variant="outlined">
          {containers.map((container, index) => (
            <MenuItem value={container.name} key={index}>
              {container.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          variant="outlined"
          label="Folder Name"
          className={classes.input}
          value={fileData.folder}
          onChange={(event) => {
            setFileData({
              ...fileData,
              folder: event.target.value,
            });
          }}
        />
        <Box className={classes.switch}>
          <Typography variant="subtitle1">Public</Typography>
          <Switch
            color="primary"
            value={fileData.isPublic}
            onChange={(event) => {
              setFileData({
                ...fileData,
                isPublic: event.target.checked,
              });
            }}
          />
        </Box>
        <Box className={classes.buttonContainer}>
          <Button
            variant="contained"
            color="primary"
            className={classes.saveButton}
            onClick={() => handleAdd()}>
            Add
          </Button>
          <Button variant="outlined" onClick={() => handleCancel()}>
            Cancel
          </Button>
        </Box>
      </Box>
    </DrawerWrapper>
  );
};

export default StorageAddDrawer;
