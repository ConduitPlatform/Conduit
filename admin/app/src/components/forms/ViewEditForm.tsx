import React from 'react';
import { Box, Container, Grid, Button, Paper } from '@material-ui/core';
import Image from 'next/dist/client/image';
import FormsImage from '../../assets/svgs/forms.svg';
import { FormsModel } from '../../models/forms/FormsModels';
import sharedClasses from '../common/sharedClasses';
import EditableForm from './EditableForm';
import ExtractView from '../payments/ExtractView';

interface Props {
  handleCreate: (formsState: FormsModel) => void;
  handleSave: (formsState: FormsModel) => void;
  form: FormsModel;
  edit: boolean;
  setEdit: (value: boolean) => void;
  create: boolean;
  setCreate: (value: boolean) => void;
}

const ViewEditForm: React.FC<Props> = ({
  handleCreate,
  handleSave,
  form,
  edit,
  setEdit,
  create,
  setCreate,
}) => {
  const classes = sharedClasses();

  const handleSaveClick = (data: FormsModel) => {
    if (create) {
      handleCreate(data);
    } else {
      handleSave(data);
    }
    setCreate(false);
    setEdit(!edit);
  };

  return (
    <Container>
      <Box>
        <Paper elevation={0} className={classes.paper}>
          <Grid container spacing={2}>
            {edit ? (
              <>
                <EditableForm preloadedValues={form} handleSubmitData={handleSaveClick} />
              </>
            ) : (
              <ExtractView valuesToShow={form} />
            )}
          </Grid>
        </Paper>
        {!edit && (
          <>
            <Grid container spacing={2} justify="center">
              <Grid item>
                <Button onClick={() => setEdit(!edit)}>Edit</Button>
              </Grid>
            </Grid>
            <div className={classes.centeredImg}>
              <Image src={FormsImage} width="200px" alt="mail" />
            </div>
          </>
        )}
      </Box>
    </Container>
  );
};

export default ViewEditForm;
