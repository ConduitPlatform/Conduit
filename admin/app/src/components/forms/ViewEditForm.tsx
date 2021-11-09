import React from 'react';
import { Box, Container, Grid, Typography } from '@material-ui/core';
import Image from 'next/dist/client/image';
import FormsImage from '../../assets/svgs/forms.svg';
import { Button, Paper } from '@material-ui/core';
import { FormsModel } from '../../models/forms/FormsModels';
import sharedClasses from '../common/sharedClasses';
import EditableForm from './EditableForm';

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
    <Container className={classes.marginTop}>
      <Box>
        <Paper elevation={0} className={classes.paper}>
          <Grid container spacing={2}>
            {edit ? (
              <>
                <EditableForm preloadedValues={form} handleSubmitData={handleSaveClick} />
              </>
            ) : (
              <>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Form name:</Typography>
                  <Typography variant="h6">{form.name}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Fields:</Typography>
                  <Typography variant="h6">Fields...</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Forward To:</Typography>
                  <Typography variant="h6">{form.forwardTo}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Email Field:</Typography>
                  <Typography variant="h6">{form.emailField}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Enabled:</Typography>
                  <Typography variant="h6">{form.enabled ? 'true' : 'false'}</Typography>
                </Grid>
              </>
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
