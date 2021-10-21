import React, { FC, useState } from 'react';
import { Box, Button, MenuItem, Switch, TextField } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import DrawerWrapper from '../navigation/SideDrawerWrapper';
import { makeStyles } from '@material-ui/core/styles';
import Dropzone from '../common/Dropzone';

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

interface FileData {
  name: string;
  data: string;
  folder: string;
  container: string;
  isPublic: boolean;
}

interface Props {
  open: boolean;
  closeDrawer: () => void;
}

const containers = ['conduit', 'conduit-1', 'conduit-2', 'conduit-3', 'conduit-4'];

const StorageAddDrawer: FC<Props> = ({ open, closeDrawer }) => {
  const classes = useStyles();

  const initialFileData = {
    name: '',
    data: '',
    folder: '',
    container: '',
    isPublic: false,
  };
  const [fileData, setFileData] = useState<FileData>(initialFileData);

  const handleCancel = () => {
    closeDrawer();
    setFileData(initialFileData);
  };

  const handleAdd = () => {
    // console.log('handleAdd');
  };

  return (
    <DrawerWrapper open={open} closeDrawer={() => closeDrawer()} width={512}>
      <Box className={classes.root}>
        <Typography variant="h6" className={classes.title}>
          Add File
        </Typography>
        <Dropzone
          file={fileData.data}
          setFile={(value) => {
            setFileData({
              ...fileData,
              data: value,
            });
          }}
        />
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
            <MenuItem value={container} key={index}>
              {container}
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
