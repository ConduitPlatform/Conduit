import { Button, Container, Grid, TextField } from '@material-ui/core';
import React, { FC } from 'react';
import { useForm, Controller } from 'react-hook-form';
import TemplateEditor from './TemplateEditor';
import sharedClasses from '../common/sharedClasses';
import { FormInputText } from '../common/RHFormComponents/RHFInputText';
import { EmailData, SendEmailData } from '../../models/emails/EmailModels';

interface ITemplateForm {
  name: string;
  sender: string;
  subject: string;
  body: string;
}

interface Props {
  preloadedValues: EmailData;
  handleSubmitData: (data: any) => void;
}

const TemplateForm: FC<Props> = ({ preloadedValues, handleSubmitData }) => {
  const classes = sharedClasses();

  const methods = useForm<ITemplateForm>({ defaultValues: preloadedValues });

  const { handleSubmit, reset, control } = methods;

  const onSubmit = (data: SendEmailData) => {
    handleSubmitData({ ...data });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{}}>
      <Container className={classes.root} maxWidth="xl">
        <Grid container alignItems="center" className={classes.root} spacing={2}>
          <Grid item sm={12}>
            <FormInputText
              name="name"
              control={control}
              label="Name"
              required={'Name is required'}
              pattern={/^S*$/}
              errMsg={'No spaces allowed on template name'}
            />
          </Grid>
          <Grid item sm={12}>
            <FormInputText name="sender" control={control} label="Sender*" />
          </Grid>
          <Grid item sm={12}>
            <FormInputText
              name="subject"
              control={control}
              label="Subject"
              required={'Subject is required'}
            />
          </Grid>
          <Grid item sm={12}>
            <Controller
              name="body"
              control={control}
              defaultValue=""
              render={({ field: { onChange, value }, fieldState: { error } }) => (
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
  );
};

export default TemplateForm;
