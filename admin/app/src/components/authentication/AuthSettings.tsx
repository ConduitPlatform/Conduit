import { Container, makeStyles } from '@material-ui/core';
import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';
import { SettingsStateTypes, SignInMethods } from '../../models/authentication/AuthModels';
import { FormSwitch } from '../common/FormComponents/FormSwitch';
import { FormInput } from '../common/FormComponents/FormInput';
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
  const { handleSubmit, reset, control } = methods;

  useEffect(() => {
    reset(settingsData);
  }, [reset, settingsData]);

  const isActive = useWatch({
    control,
    name: 'active',
  });

  const handleCancel = () => {
    setEdit(!edit);
    reset();
  };

  const handleEditClick = () => {
    setEdit(true);
  };

  const onSubmit = (data: SignInMethods) => {
    setEdit(false);
    handleSave(data);
  };

  const textFields = [
    'rateLimit',
    'tokenInvalidationPeriod',
    'refreshTokenInvalidationPeriod',
    'jwtSecret',
  ];

  return (
    <Container maxWidth="md">
      <Paper className={classes.paper}>
        <form onSubmit={handleSubmit(onSubmit)} style={{}}>
          <Grid container spacing={3}>
            <Box
              width={'100%'}
              display={'inline-flex'}
              justifyContent={'space-between'}
              alignItems={'center'}>
              <Typography variant={'h6'}>Activate Authentication Module</Typography>
              <FormSwitch control={control} name={'active'} disabled={!edit} />
            </Box>
            <Divider className={classes.divider} />
            <Grid container spacing={2} className={classes.innerGrid}>
              {isActive && (
                <>
                  {textFields.map((textField, index) => (
                    <Grid key={index} item xs={6}>
                      <FormInput
                        name={textField}
                        control={control}
                        label={startCase(camelCase(textField))}
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
                      <Typography variant={'subtitle1'}>Allow Refresh Token generation</Typography>
                      <FormSwitch
                        name={'generateRefreshToken'}
                        control={control}
                        disabled={!edit}
                      />
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
      </Paper>
    </Container>
  );
};

export default AuthSettings;
