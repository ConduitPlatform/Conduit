import { makeStyles } from '@material-ui/core/styles';
import React from 'react';
import { Grid, Container, Button } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import { useForm } from 'react-hook-form';
import { FormInputDropdown } from '../common/RHFormComponents/RHFDropdown';
import { FormInputText } from '../common/RHFormComponents/RHFInputText';
import { FormSwitch } from '../common/RHFormComponents/RHFSwitch';

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

  const { handleSubmit, reset, control } = methods;

  // const onSaveClick = (data: CoreSettings) => {
  //   // const data = {
  //   //   port: port,
  //   //   hostUrl: url,
  //   //   rest: toggleRest,
  //   //   graphql: toggleGraphQL,
  //   //   env: selectedEnum,
  //   // };
  //   //dispatch(putCoreSettings(data));
  //   console.log(data);
  // };

  const selectOptions = [
    { name: 'development', label: 'development' },
    { name: 'production', label: 'production' },
    { name: 'test', label: 'test' },
  ];

  return (
    <Container>
      <Grid container justify={'center'}>
        <form>
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
            <FormInputDropdown
              name="selectedEnum"
              control={control}
              label="Environment"
              options={selectOptions}
            />
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
              <Typography component={'span'} variant={'subtitle2'} className={classes.textSpacing}>
                Url:
              </Typography>
              <FormInputText name="url" label="URL" control={control} />
            </Grid>
            <Grid item container alignItems={'center'} wrap={'nowrap'}>
              <Typography component={'span'} variant={'subtitle2'} className={classes.textSpacing}>
                Port:
              </Typography>
              <FormInputText name="port" label="Port" control={control} />
            </Grid>
          </Grid>
          <Grid item xs={12} style={{ marginTop: 32 }}>
            <Typography variant={'h6'}>Transport section</Typography>
          </Grid>
          <Grid item xs={12} container alignItems={'center'}>
            <Typography variant={'subtitle1'}>Toggle Rest:</Typography>
            <FormSwitch name="toggleRest" control={control} />
          </Grid>
          <Grid item xs={12} container alignItems={'center'}>
            <Typography variant={'subtitle1'}>Toggle GraphQL:</Typography>
            <FormSwitch name="toggleGraphQL" control={control} />
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
      </Grid>
    </Container>
  );
};

export default CoreSettingsTab;
