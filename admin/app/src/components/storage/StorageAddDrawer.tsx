import React, { FC, useEffect, useMemo, useState } from 'react';
import { Button, Container, Grid } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import DrawerWrapper from '../navigation/SideDrawerWrapper';
import Dropzone from '../common/Dropzone';
import { IContainer, IStorageFile } from '../../models/storage/StorageModels';
import { FormProvider, useForm } from 'react-hook-form';
import { FormInputText } from '../common/FormComponents/FormInputText';
import { FormInputSelect } from '../common/FormComponents/FormInputSelect';
import { FormInputSwitch } from '../common/FormComponents/FormInputSwitch';
import sharedClasses from '../common/sharedClasses';

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
  container: string;
  isPublic: boolean;
}

const StorageAddDrawer: FC<Props> = ({ open, closeDrawer, containers, handleAddFile, path }) => {
  const classes = sharedClasses();

  const [fileData, setFileData] = useState<{ data: string; mimeType: string }>({
    data: '',
    mimeType: '',
  });
  const methods = useForm<FormData>({
    defaultValues: useMemo(() => {
      return { name: '', folder: '', container: '', isPublic: false };
    }, []),
  });
  const { reset, setValue } = methods;

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
      return { label: container.name, value: container.name };
    });
  };

  return (
    <DrawerWrapper open={open} closeDrawer={() => closeDrawer()} width={512}>
      <Container maxWidth="lg">
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(handleAdd)}>
            <Grid container alignItems="center" className={classes.root} spacing={2}>
              <Grid item sm={12}>
                <Typography variant="h6">Add File</Typography>
              </Grid>
              <Grid item sm={12}>
                <Dropzone file={fileData.data} setFile={handleSetFile} />
              </Grid>
              <Grid item sm={12}>
                <FormInputText name="name" label="File name" />
              </Grid>
              <Grid item sm={12}>
                <FormInputSelect options={extractContainers()} label="Container" name="container" />
              </Grid>
              <Grid item sm={12}>
                <FormInputText name="folder" label="Folder name" />
              </Grid>
              <Grid item sm={12}>
                <Typography variant="subtitle1">Public</Typography>
                <FormInputSwitch name="isPublic" />
              </Grid>
              <Grid container item>
                <Grid item className={classes.marginRight}>
                  <Button variant="outlined" onClick={() => handleCancel()}>
                    Cancel
                  </Button>
                </Grid>
                <Grid item>
                  <Button variant="contained" color="primary" type="submit">
                    Add
                  </Button>
                </Grid>
              </Grid>
            </Grid>
          </form>
        </FormProvider>
      </Container>
    </DrawerWrapper>
  );
};

export default StorageAddDrawer;
