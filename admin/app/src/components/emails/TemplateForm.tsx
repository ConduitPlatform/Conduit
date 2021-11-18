import { Button, Container, Grid } from '@material-ui/core';
import React, { FC } from 'react';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import TemplateEditor from './TemplateEditor';
import sharedClasses from '../common/sharedClasses';
import { FormInputText } from '../common/FormComponents/FormInputText';
import { EmailTemplateType } from '../../models/emails/EmailModels';

interface ITemplateForm {
  name: string;
  sender: string;
  subject: string;
  body: string;
}

interface Props {
  preloadedValues: EmailTemplateType;
  handleSubmitData: (data: EmailTemplateType) => void;
}

const TemplateForm: FC<Props> = ({ preloadedValues, handleSubmitData }) => {
  const classes = sharedClasses();

  const methods = useForm<ITemplateForm>({ defaultValues: preloadedValues });

  const { handleSubmit, reset } = methods;

  const onSubmit = (data: EmailTemplateType) => {
    handleSubmitData({ ...data });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} style={{}}>
        <Container className={classes.root} maxWidth="xl">
          <Grid container alignItems="center" className={classes.root} spacing={2}>
            <Grid item sm={12}>
              <FormInputText
                name="name"
                label="Name"
                rules={{ required: 'Template name is required!' }}
              />
            </Grid>
            <Grid item sm={12}>
              <FormInputText name="sender" label="Sender*" />
            </Grid>
            <Grid item sm={12}>
              <FormInputText
                name="subject"
                label="Subject"
                rules={{ required: 'Subject is required!' }}
              />
            </Grid>
            <Grid item sm={12}>
              <Controller
                name="body"
                defaultValue=""
                render={({ field: { onChange, value } }) => (
                  <TemplateEditor value={value} setValue={onChange} />
                )}
                rules={{ required: 'Template body required' }}
              />
            </Grid>
            <Grid container item xs={12} justify="space-around" style={{ marginTop: '35px' }}>
              <Grid item>
                <Button type="submit" variant="contained" color="primary" size="large">
                  Save
                </Button>
              </Grid>
              <Grid item>
                <Button onClick={() => reset()} variant="contained" color="primary" size="large">
                  Cancel
                </Button>
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </form>
    </FormProvider>
  );
};

export default TemplateForm;
