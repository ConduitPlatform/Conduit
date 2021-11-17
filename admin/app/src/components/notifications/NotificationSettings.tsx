import React, { FC, useEffect, useMemo, useState } from 'react';
import { Container, Grid, Paper, Typography } from '@material-ui/core';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { Edit, Save, SettingsOutlined } from '@material-ui/icons';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import { INotificationSettings } from '../../models/notifications/NotificationModels';
import { FormInputText } from '../common/FormComponents/FormInputText';
import { FormInputSelect } from '../common/FormComponents/FormInputSelect';
import { FormInputSwitch } from '../common/FormComponents/FormInputSwitch';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  textField: {
    marginBottom: theme.spacing(2),
  },
  simpleTextField: {
    width: '65ch',
  },
  formControl: {
    minWidth: 250,
  },
  selectEmpty: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  buttonSpacing: {
    marginLeft: theme.spacing(2),
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    width: '100%',
  },
  innerGrid: {
    padding: theme.spacing(3),
  },
  typography: {
    margin: '0px 10px 10px',
  },
}));

type NotificationSettingsProps = {
  handleSave: (value: any) => void;
  config: INotificationSettings;
};

const NotificationSettings: FC<NotificationSettingsProps> = ({ config, handleSave }) => {
  const classes = useStyles();

  const [edit, setEdit] = useState<boolean>(false);
  const methods = useForm<INotificationSettings>({
    defaultValues: useMemo(() => {
      return config;
    }, [config]),
  });
  const { reset, control, setValue } = methods;

  useEffect(() => {
    reset(config);
  }, [reset, config]);

  const isActive = useWatch({
    control,
    name: 'active',
  });

  const hasProvider = useWatch({
    control,
    name: 'providerName',
  });

  const handleCancel = () => {
    setEdit(!edit);
    reset();
  };

  const handleEditClick = () => {
    setEdit(true);
  };

  const onSubmit = (data: INotificationSettings) => {
    setEdit(false);
    const dataToSave = {
      active: data.active,
      providerName: data.providerName,
      [data.providerName]: {
        projectId: data.projectId,
        privateKey: data.privateKey,
        clientEmail: data.clientEmail,
      },
    };

    handleSave(dataToSave);
  };

  const handleFileChange = (file: File) => {
    const fileReader = new FileReader();
    fileReader.readAsText(file, 'UTF-8');
    fileReader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        const jsonToObject = JSON.parse(event.target.result);

        if (
          'projectId' in jsonToObject &&
          'privateKey' in jsonToObject &&
          'clientEmail' in jsonToObject
        ) {
          setValue('projectId', jsonToObject.projectId);
          setValue('privateKey', jsonToObject.privateKey);
          setValue('clientEmail', jsonToObject.clientEmail);
        }
      }
    };
  };

  const providers = [
    {
      name: 'firebase',
      label: 'Firebase',
    },
  ];

  return (
    <Container>
      <Paper className={classes.paper} elevation={5}>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <Grid container>
              <Box
                width={'100%'}
                display={'inline-flex'}
                justifyContent={'space-between'}
                alignItems={'center'}>
                <Typography variant={'h6'}>
                  <SettingsOutlined fontSize={'small'} style={{ marginBottom: '-2px' }} />
                  Notification settings
                </Typography>
                <FormInputSwitch name={'active'} disabled={!edit} />
              </Box>
              <Divider className={classes.divider} />
              <Grid container spacing={2} className={classes.innerGrid}>
                {isActive && (
                  <>
                    <Grid container item alignContent={'center'} xs={12}>
                      <FormInputSelect
                        label={'Provider name'}
                        name="providerName"
                        options={providers?.map((provider) => ({
                          label: provider.name,
                          value: provider.name,
                        }))}
                      />
                    </Grid>

                    {hasProvider && (
                      <>
                        <Grid item xs={12}>
                          <FormInputText name={'projectId'} label={'Project Id'} disabled={!edit} />
                        </Grid>
                        <Grid item xs={12}>
                          <FormInputText
                            name={'privateKey'}
                            label={'Private key'}
                            disabled={!edit}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <FormInputText
                            name={'clientEmail'}
                            label={'Client Email'}
                            disabled={!edit}
                          />
                        </Grid>
                        <Typography className={classes.typography}> OR </Typography>
                        <Button
                          style={{ marginTop: '30px', marginLeft: '-25px' }}
                          disabled={!edit}
                          variant="contained"
                          component="label">
                          Upload JSON File
                          <input
                            type="file"
                            hidden
                            onChange={(event) => {
                              event.target.files && handleFileChange(event.target.files[0]);
                            }}
                          />
                        </Button>
                      </>
                    )}
                  </>
                )}
              </Grid>
              <Grid item container justify="flex-end" xs={12}>
                {edit && (
                  <>
                    <Button
                      variant="outlined"
                      className={classes.buttonSpacing}
                      onClick={() => handleCancel()}
                      color="primary">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      className={classes.buttonSpacing}
                      color="primary"
                      startIcon={<Save />}>
                      Save
                    </Button>
                  </>
                )}
                {!edit && (
                  <Button
                    className={classes.buttonSpacing}
                    onClick={() => handleEditClick()}
                    color="primary"
                    startIcon={<Edit />}>
                    Edit
                  </Button>
                )}
              </Grid>
            </Grid>
          </form>
        </FormProvider>
      </Paper>
    </Container>
  );
};

export default NotificationSettings;
