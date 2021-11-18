import { makeStyles } from '@material-ui/core/styles';
import React from 'react';
import { Grid, Container, Button } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import { FormProvider, useForm } from 'react-hook-form';
import { FormInputSelect } from '../common/FormComponents/FormInputSelect';
import { FormInputText } from '../common/FormComponents/FormInputText';
import { FormInputSwitch } from '../common/FormComponents/FormInputSwitch';

const useStyles = makeStyles(() => ({
  textSpacing: {
    marginRight: 12,
    fontWeight: 'bold',
  },
}));

interface CoreSettings {
  selectedEnum: string;
  url: string;
  port: number;
  toggleRest: boolean;
  toggleGraphQL: boolean;
}

const initialStates = {
  selectedEnum: 'development',
  url: 'http://localhost',
  port: 8080,
  toggleRest: true,
  toggleGraphQL: true,
};

const CoreSettingsTab: React.FC = () => {
  const classes = useStyles();
  // const dispatch = useDispatch();
  const methods = useForm<CoreSettings>({ defaultValues: initialStates });

  const { reset } = methods;

  const onSaveClick = (data: CoreSettings) => {
    // const data = {
    //   port: port,
    //   hostUrl: url,
    //   rest: toggleRest,
    //   graphql: toggleGraphQL,
    //   env: selectedEnum,
    // };
    //dispatch(putCoreSettings(data));
    console.log(data);
  };

  const selectOptions = [
    { value: 'development', label: 'development' },
    { value: 'production', label: 'production' },
    { value: 'test', label: 'test' },
  ];

  return (
    <Container>
      <Grid container justify={'center'}>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSaveClick)}>
            <Grid item xs={12}>
              <Typography variant={'h6'}>Core settings</Typography>
              <Typography variant={'subtitle1'}>
                Below you can see information about the Conduit location
              </Typography>
            </Grid>
            <Grid item xs={12} container alignItems={'center'}>
              <Typography variant={'subtitle2'} className={classes.textSpacing}>
                Environment:
              </Typography>
              <FormInputSelect name="selectedEnum" label="Environment" options={selectOptions} />
            </Grid>
            <Grid item xs={12} style={{ marginTop: 16 }} container wrap={'nowrap'}>
              <Grid
                item
                xs={8}
                sm={4}
                container
                alignItems={'center'}
                wrap={'nowrap'}
                style={{ marginRight: 32 }}>
                <Typography
                  component={'span'}
                  variant={'subtitle2'}
                  className={classes.textSpacing}>
                  Url:
                </Typography>
                <FormInputText name="url" label="URL" />
              </Grid>
              <Grid item container alignItems={'center'} wrap={'nowrap'}>
                <Typography
                  component={'span'}
                  variant={'subtitle2'}
                  className={classes.textSpacing}>
                  Port:
                </Typography>
                <FormInputText name="port" label="Port" />
              </Grid>
            </Grid>
            <Grid item xs={12} style={{ marginTop: 32 }}>
              <Typography variant={'h6'}>Transport section</Typography>
            </Grid>
            <Grid item xs={12} container alignItems={'center'}>
              <Typography variant={'subtitle1'}>Toggle Rest:</Typography>
              <FormInputSwitch name="toggleRest" />
            </Grid>
            <Grid item xs={12} container alignItems={'center'}>
              <Typography variant={'subtitle1'}>Toggle GraphQL:</Typography>
              <FormInputSwitch name="toggleGraphQL" />
            </Grid>
            <Grid item xs={12} style={{ marginTop: 32 }}>
              <Button
                style={{ marginRight: 32 }}
                placeholder={'Cancel'}
                onClick={() => reset()}
                variant={'contained'}>
                Cancel
              </Button>
              <Button placeholder={'Save'} variant={'contained'} color={'primary'} type="submit">
                Save
              </Button>
            </Grid>
          </form>
        </FormProvider>
      </Grid>
    </Container>
  );
};

export default CoreSettingsTab;
