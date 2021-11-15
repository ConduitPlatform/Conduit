import React, { FC, useEffect, useMemo, useState } from 'react';
import { Box, Button, Grid } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import DrawerWrapper from '../navigation/SideDrawerWrapper';
import { makeStyles } from '@material-ui/core/styles';
import Dropzone from '../common/Dropzone';
import { IContainer, IStorageFile } from '../../models/storage/StorageModels';
import { useForm } from 'react-hook-form';
import { FormInputText } from '../common/RHFormComponents/RHFInputText';
import { FormInputDropdown } from '../common/RHFormComponents/RHFDropdown';
import { FormSwitch } from '../common/RHFormComponents/RHFSwitch';

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
  padding: {
    padding: theme.spacing(6),
  },
}));

interface Props {
  open: boolean;
  closeDrawer: () => void;
  containers: IContainer[];
  handleAddFile: (data: IStorageFile) => void;
  path: string[];
}

interface FormData {
  name: string;
  folder: string;
  container: any;
  isPublic: boolean;
}

const StorageAddDrawer: FC<Props> = ({ open, closeDrawer, containers, handleAddFile, path }) => {
  const classes = useStyles();

  const [fileData, setFileData] = useState<any>({ data: '', mimeType: '' });
  const methods = useForm<FormData>({
    defaultValues: useMemo(() => {
      return { name: '', folder: '', container: '', isPublic: false };
    }, []),
  });
  const { handleSubmit, reset, control, setValue } = methods;

  useEffect(() => {
    if (path.length < 1) return;
    if (path.length > 1) {
      setValue('folder', path[path.length - 1]);
      setValue('container', path[0]);
    }
    setValue('folder', '');
    setValue('container', path[0]);
  }, [path, setValue]);

  const setInitialFileData = () => {
    reset();
  };

  const handleCancel = () => {
    closeDrawer();
    setInitialFileData();
  };

  const handleAdd = (data: FormData) => {
    closeDrawer();
    const sendFileData = {
      ...data,
      folder: data.folder ? `${data.folder}/` : undefined,
      data: fileData.data,
      mimeType: fileData.mimeType,
    };

    setInitialFileData();
    handleAddFile(sendFileData);
  };

  const handleSetFile = (data: string, mimeType: string, name: string) => {
    setFileData({
      data: data,
      mimeType: mimeType,
    });
    setValue('name', name);
  };

  const extractContainers = () => {
    return containers.map((container) => {
      return { value: container.name, label: container.name };
    });
  };

  return (
    <DrawerWrapper open={open} closeDrawer={() => closeDrawer()} width={512}>
      <form onSubmit={handleSubmit(handleAdd)}>
        <Typography variant="h6" className={classes.title}>
          Add File
        </Typography>
        <Dropzone file={fileData.data} setFile={handleSetFile} />
        <Grid className={classes.padding} container spacing={3}>
          <Grid item sm={12}>
            <FormInputText name="name" label="File name" control={control} />
          </Grid>
          <Grid item sm={12}>
            <FormInputDropdown
              options={extractContainers()}
              label="Container"
              name="container"
              control={control}
            />
          </Grid>
          <Grid item sm={12}>
            <FormInputText name="folder" label="Folder name" control={control} />
          </Grid>
          <Grid item sm={12}>
            <Box className={classes.switch}>
              <Typography variant="subtitle1">Public</Typography>
              <FormSwitch control={control} name="isPublic" />
            </Box>
          </Grid>
          <Box className={classes.buttonContainer}>
            <Button
              variant="contained"
              color="primary"
              className={classes.saveButton}
              type="submit">
              Add
            </Button>
            <Button variant="outlined" onClick={() => handleCancel()}>
              Cancel
            </Button>
          </Box>
        </Grid>
      </form>
    </DrawerWrapper>
  );
};

export default StorageAddDrawer;
