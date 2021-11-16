import { Container, makeStyles } from '@material-ui/core';
import React, { useEffect, useMemo, useState } from 'react';
import { useForm, FormProvider, useWatch } from 'react-hook-form';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';
import { SettingsStateTypes, SignInMethods } from '../../models/authentication/AuthModels';
import { FormInputSwitch } from '../common/FormComponents/FormInputSwitch';
import { FormInputText } from '../common/FormComponents/FormInputText';
import { camelCase, startCase } from 'lodash';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    width: '100%',
  },
  innerGrid: {
    padding: theme.spacing(3),
  },
}));

interface Props {
  handleSave: (data: SettingsStateTypes) => void;
  settingsData: SignInMethods;
}

const AuthSettings: React.FC<Props> = ({ handleSave, settingsData }) => {
  const classes = useStyles();
  const [edit, setEdit] = useState<boolean>(false);
  const methods = useForm<SignInMethods>({
    defaultValues: useMemo(() => {
      return settingsData;
    }, [settingsData]),
  });

  const { control } = methods;

  useEffect(() => {
    methods.reset(settingsData);
  }, [methods, settingsData]);

  const isActive = useWatch({
    control,
    name: 'active',
  });

  const handleCancel = () => {
    setEdit(!edit);
    methods.reset();
  };

  const handleEditClick = () => {
    setEdit(true);
  };

  const onSubmit = (data: SignInMethods) => {
    setEdit(false);
    handleSave(data);
  };

  const inputFields = [
    'rateLimit',
    'tokenInvalidationPeriod',
    'refreshTokenInvalidationPeriod',
    'jwtSecret',
  ];

  return (
    <Container maxWidth="md">
      <Paper className={classes.paper}>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} style={{}}>
            <Grid container spacing={3}>
              <Box
                width={'100%'}
                display={'inline-flex'}
                justifyContent={'space-between'}
                alignItems={'center'}>
                <Typography variant={'h6'}>Activate Authentication Module</Typography>
                <FormInputSwitch name={'active'} disabled={!edit} />
              </Box>
              <Divider className={classes.divider} />
              <Grid container spacing={2} className={classes.innerGrid}>
                {isActive && (
                  <>
                    {inputFields.map((field, index) => (
                      <Grid key={index} item xs={6}>
                        <FormInputText
                          name={field}
                          label={startCase(camelCase(field))}
                          disabled={!edit}
                        />
                      </Grid>
                    ))}
                    <Grid item xs={6}>
                      <Box
                        width={'100%'}
                        display={'inline-flex'}
                        justifyContent={'space-between'}
                        alignItems={'center'}>
                        <Typography variant={'subtitle1'}>
                          Allow Refresh Token generation
                        </Typography>
                        <FormInputSwitch name={'generateRefreshToken'} disabled={!edit} />
                      </Box>
                    </Grid>
                  </>
                )}
              </Grid>
              {edit && (
                <Grid item container xs={12} justify={'flex-end'}>
                  <Button
                    onClick={() => handleCancel()}
                    style={{ marginRight: 16 }}
                    color={'primary'}>
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    style={{ alignSelf: 'flex-end' }}
                    type="submit">
                    Save
                  </Button>
                </Grid>
              )}
              {!edit && (
                <Grid item container xs={12} justify={'flex-end'}>
                  <Button
                    onClick={() => handleEditClick()}
                    style={{ marginRight: 16 }}
                    color={'primary'}>
                    Edit
                  </Button>
                </Grid>
              )}
            </Grid>
          </form>
        </FormProvider>
      </Paper>
    </Container>
  );
};

export default AuthSettings;
