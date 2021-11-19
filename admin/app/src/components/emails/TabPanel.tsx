import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import React from 'react';
import { EmailTemplateType } from '../../models/emails/EmailModels';
import Image from 'next/dist/client/image';
import EmailImage from '../../assets/email.svg';
import { Button, Paper } from '@material-ui/core';
import sharedClasses from '../common/sharedClasses';

import TemplateForm from './TemplateForm';

interface Props {
  handleCreate: (templateState: EmailTemplateType) => void;
  handleSave: (templateState: EmailTemplateType) => void;
  template: EmailTemplateType;
  edit: boolean;
  setEdit: (value: boolean) => void;
  create: boolean;
  setCreate: (value: boolean) => void;
}

const TabPanel: React.FC<Props> = ({
  handleCreate,
  handleSave,
  template,
  edit,
  setEdit,
  create,
  setCreate,
}) => {
  const classes = sharedClasses();

  const handleSaveClick = (data: EmailTemplateType) => {
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
          <Grid container spacing={2} justify="space-around">
            {edit ? (
              <TemplateForm preloadedValues={template} handleSubmitData={handleSaveClick} />
            ) : (
              <>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Template name:</Typography>
                  <Typography variant="h6">{template.name}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Sender:</Typography>
                  <Typography variant="h6">{template.sender}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body1">Subject</Typography>
                  <Typography variant="subtitle2">{template.subject}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body1">Body</Typography>
                  <Typography variant="subtitle2" style={{ whiteSpace: 'pre-line' }}>
                    {template.body}
                  </Typography>
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
              <Image src={EmailImage} width="200px" alt="mail" />
            </div>
          </>
        )}
      </Box>
    </Container>
  );
};

export default TabPanel;
