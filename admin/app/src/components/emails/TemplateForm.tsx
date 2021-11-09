import { Button, Container, Grid, TextField } from '@material-ui/core';
import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import TemplateEditor from './TemplateEditor';
import sharedClasses from '../common/sharedClasses';

const TemplateForm = ({ preloadedValues, handleSubmitData }) => {
  const classes = sharedClasses();
  const { register, handleSubmit, reset, control } = useForm({
    defaultValues: preloadedValues,
  });

  const onSubmit = (data) => {
    handleSubmitData({ ...data });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{}}>
      <Container className={classes.root} maxWidth="xl">
        <Grid container alignItems="center" className={classes.root} spacing={2}>
          <Grid item sm={12}>
            <Controller
              {...register('name', { required: true })}
              control={control}
              defaultValue=""
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <TextField
                  className={classes.textField}
                  label={'Template name'}
                  variant={'outlined'}
                  value={value}
                  onChange={onChange}
                />
              )}
              rules={{ required: 'Name required' }}
            />
          </Grid>
          <Grid item sm={12}>
            <Controller
              {...register('sender', { required: true })}
              control={control}
              defaultValue=""
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <TextField
                  className={classes.textField}
                  label={'Sender(optional)'}
                  variant={'outlined'}
                  value={value}
                  onChange={onChange}
                />
              )}
            />
          </Grid>
          <Grid item sm={12}>
            <Controller
              {...register('subject', { required: true })}
              control={control}
              defaultValue=""
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <TextField
                  fullWidth
                  label={'Subject'}
                  variant="outlined"
                  className={classes.textField}
                  value={value}
                  onChange={onChange}
                />
              )}
              rules={{ required: 'Subject required' }}
            />
          </Grid>
          <Grid item sm={12}>
            <Controller
              {...register('body', { required: true })}
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
