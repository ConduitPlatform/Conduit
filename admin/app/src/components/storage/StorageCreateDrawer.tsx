import React, { FC, useEffect } from 'react';
import { Button, Container, Grid } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import DrawerWrapper from '../navigation/SideDrawerWrapper';
import { CreateFormSelected, IContainer, ICreateForm } from '../../models/storage/StorageModels';
import { FormProvider, useForm } from 'react-hook-form';
import { FormInputText } from '../common/FormComponents/FormInputText';
import { FormInputSelect } from '../common/FormComponents/FormInputSelect';
import { FormInputSwitch } from '../common/FormComponents/FormInputSwitch';
import sharedClasses from '../common/sharedClasses';

interface Props {
  data: { open: boolean; type: CreateFormSelected };
  closeDrawer: () => void;
  containers: IContainer[];
  handleCreateFolder: (data: ICreateForm['folder']) => void;
  handleCreateContainer: (data: ICreateForm['container']) => void;
  path: string[];
}

interface FormProps {
  name: string;
  container?: string;
  isPublic: boolean;
}

const StorageCreateDrawer: FC<Props> = ({
  data,
  closeDrawer,
  containers,
  handleCreateFolder,
  handleCreateContainer,
  path,
}) => {
  const classes = sharedClasses();
  const methods = useForm<FormProps>({
    defaultValues: { name: '', container: '', isPublic: false },
  });
  const { reset, setValue } = methods;

  useEffect(() => {
    if (data.type === CreateFormSelected.folder) {
      setValue('container', path[0]);
    }
  }, [path, data.type, setValue]);

  const handleCancel = () => {
    reset();
    closeDrawer();
  };

  const handleSave = (formData: FormProps) => {
    if (data.type === CreateFormSelected.container) {
      handleCreateContainer({ name: formData.name, isPublic: formData.isPublic });
      reset();
      closeDrawer();
      return;
    }
    if (formData.container !== undefined) {
      const folderData = {
        name: `${formData.name}/`,
        container: formData.container,
        isPublic: formData.isPublic,
      };
      handleCreateFolder(folderData);
    }
    reset();
    closeDrawer();
  };

  const extractContainers = () => {
    return containers.map((container) => {
      return { label: container.name, value: container.name };
    });
  };

  return (
    <DrawerWrapper open={data.open} closeDrawer={() => closeDrawer()} width={256}>
      <Container maxWidth="lg">
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(handleSave)}>
            <Grid container alignItems="center" className={classes.root} spacing={2}>
              <Grid item sm={12}>
                <Typography variant="h6" className={classes.marginTop}>
                  Create {data.type}
                </Typography>
              </Grid>
              <Grid item sm={12}>
                <FormInputText name="name" label="Name" />
              </Grid>
              {data.type === CreateFormSelected.folder && (
                <Grid item sm={12}>
                  <FormInputSelect
                    options={extractContainers()}
                    label="Container"
                    name="container"
                  />
                </Grid>
              )}
              <Grid item sm={12}>
                <Typography variant="subtitle1">Is Public</Typography>
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
                    Save
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

export default StorageCreateDrawer;
