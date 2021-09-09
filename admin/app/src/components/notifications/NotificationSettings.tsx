import React, { FC, useEffect, useState } from 'react';
import {
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@material-ui/core';
import { Edit, Save, SettingsOutlined } from '@material-ui/icons';
import makeStyles from '@material-ui/core/styles/makeStyles';
import TextField from '@material-ui/core/TextField';
import clsx from 'clsx';
import Button from '@material-ui/core/Button';
import { Formik } from 'formik';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import { saveConfig } from '../../redux/thunks/notificationThunks';
import { INotificationSettings } from '../../models/notifications/NotificationModels';

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
    paddingLeft: theme.spacing(4),
  },
}));

type NotificationSettingsProps = {
  handleSave: (value: any) => void;
  config: any;
};

const NotificationSettings: FC<NotificationSettingsProps> = ({ config, handleSave }) => {
  const classes = useStyles();
  const [editProvider, setEditProvider] = useState(true);
  const [formData, setFormData] = useState<INotificationSettings>({
    active: true,
    providerName: '',
    projectId: '',
    privateKey: '',
    clientEmail: '',
  });

  useEffect(() => {
    if (!config) {
      return;
    }
    let data;
    if (config[config.providerName]) {
      data = {
        active: config.active,
        providerName: config.providerName,
        projectId: config[config.providerName].projectId,
        privateKey: config[config.providerName].privateKey,
        clientEmail: config[config.providerName].clientEmail,
      };
    } else {
      data = {
        active: config.active,
        providerName: config.providerName,
        projectId: '',
        privateKey: '',
        clientEmail: '',
      };
    }
    setFormData({ ...data });
  }, [config]);

  const handleSelect = (event) => {
    setFormData({
      ...formData,
      providerName: event.target.value,
    });
  };

  const handleToggleEdit = () => {
    setEditProvider(false);
  };

  const handleCancelButton = (reset) => {
    reset();
    setEditProvider(true);
  };

  const onFormSubmit = (values: INotificationSettings) => {
    const data = {
      active: values.active,
      providerName: values.providerName,
      [values.providerName]: {
        projectId: values.projectId,
        privateKey: values.privateKey,
        clientEmail: values.clientEmail,
      },
    };
    handleSave(data);
  };

  const renderFields = () => {
    return (
      <>
        <Grid container item alignContent={'center'} xs={12}>
          <FormControl variant="outlined" className={classes.formControl}>
            <InputLabel>Provider</InputLabel>
            <Select
              required
              labelId="provider-outlined-label"
              value={formData.providerName}
              onChange={handleSelect}
              label="Provider">
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              <MenuItem value={'firebase'}> Firebase </MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          {formData.providerName && (
            <Formik
              style={{ width: '100%' }}
              initialValues={formData}
              onSubmit={(values, { setSubmitting, resetForm }) => {
                onFormSubmit(values);
                resetForm({
                  values: formData,
                });
                setSubmitting(false);
              }}>
              {({ handleSubmit, handleChange, values, handleReset }) => {
                return (
                  <form onSubmit={handleSubmit}>
                    <Grid item xs={12}>
                      <TextField
                        onChange={handleChange}
                        value={values.projectId}
                        disabled={editProvider}
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        id="projectId"
                        label="Project Id"
                        type="text"
                        name="projectId"
                        autoComplete="projectId"
                        autoFocus
                        className={clsx(classes.textField, classes.simpleTextField)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        onChange={handleChange}
                        value={values.privateKey}
                        disabled={editProvider}
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        name="privateKey"
                        label="Private key"
                        type="text"
                        id="privateKey"
                        autoComplete="privateKey"
                        className={clsx(classes.textField, classes.simpleTextField)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        onChange={handleChange}
                        value={values.clientEmail}
                        disabled={editProvider}
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        name="clientEmail"
                        label="Client email"
                        type="email"
                        id="clientEmail"
                        autoComplete="clientEmail"
                        className={clsx(classes.textField, classes.simpleTextField)}
                      />
                    </Grid>
                    <Grid item container justify="flex-end" xs={12}>
                      {!editProvider ? (
                        <>
                          <Button
                            variant="outlined"
                            className={classes.buttonSpacing}
                            onClick={() => handleCancelButton(handleReset)}
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
                      ) : (
                        <Button
                          variant="contained"
                          className={classes.buttonSpacing}
                          onClick={handleToggleEdit}
                          color="primary"
                          startIcon={<Edit />}>
                          Edit
                        </Button>
                      )}
                    </Grid>
                  </form>
                );
              }}
            </Formik>
          )}
        </Grid>
      </>
    );
  };

  return (
    <Container>
      <Paper className={classes.paper} elevation={5}>
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
            <FormControlLabel
              control={
                <Switch
                  checked={formData.active}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      active: !formData.active,
                    })
                  }
                  value={'accountLinking'}
                  color="primary"
                />
              }
              label={''}
            />
          </Box>

          <Divider className={classes.divider} />

          <Grid container spacing={2} className={classes.innerGrid}>
            {formData.active && renderFields()}
          </Grid>

          {!formData.active && (
            <Grid item container xs={12} justify={'flex-end'}>
              <Button
                variant="contained"
                color="primary"
                style={{ alignSelf: 'flex-end' }}
                onClick={() => saveConfig()}>
                Save
              </Button>
            </Grid>
          )}
        </Grid>
      </Paper>
    </Container>
  );
};

export default NotificationSettings;
