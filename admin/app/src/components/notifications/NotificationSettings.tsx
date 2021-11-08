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
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import { INotificationSettings } from '../../models/notifications/NotificationModels';
import ConfirmationDialog from '../common/ConfirmationDialog';

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

  const initialFormData = {
    active: true,
    providerName: '',
    projectId: '',
    privateKey: '',
    clientEmail: '',
  };
  const [edit, setEdit] = useState<boolean>(false);
  const [formData, setFormData] = useState<INotificationSettings>(initialFormData);
  const [openSaveDialog, setOpenSaveDialog] = useState<boolean>(false);

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

  const handleSelect = (event: { target: { value: any } }) => {
    setFormData({
      ...formData,
      providerName: event.target.value,
    });
  };

  const handleToggleEdit = () => {
    setEdit(!edit);
  };

  const handleCancelButton = () => {
    setFormData(initialFormData);
    setEdit(false);
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

  const handleFileChange = (e: any) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], 'UTF-8');
    fileReader.onload = (event: any) => {
      const jsonToObject = JSON.parse(event.target?.result);

      if (
        'project_id' in jsonToObject &&
        'private_key' in jsonToObject &&
        'client_email' in jsonToObject
      )
        setFormData({
          ...formData,
          projectId: jsonToObject.project_id,
          privateKey: jsonToObject.private_key,
          clientEmail: jsonToObject.client_email,
        });
    };
  };

  const renderFields = () => {
    return (
      <>
        <Grid container item alignContent={'center'} xs={12}>
          <FormControl variant="outlined" className={classes.formControl}>
            <InputLabel>Provider</InputLabel>
            <Select
              required
              disabled={!edit}
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
            <>
              <Grid item xs={12}>
                <TextField
                  onChange={(event) => {
                    setFormData({
                      ...formData,
                      projectId: event.target.value,
                    });
                  }}
                  value={formData.projectId}
                  disabled={!edit}
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
                  onChange={(event) => {
                    setFormData({
                      ...formData,
                      privateKey: event.target.value,
                    });
                  }}
                  value={formData.privateKey}
                  disabled={!edit}
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
                  onChange={(event) => {
                    setFormData({
                      ...formData,
                      clientEmail: event.target.value,
                    });
                  }}
                  value={formData.clientEmail}
                  disabled={!edit}
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
              <Typography> OR </Typography>
              <Button
                style={{ marginTop: '20px' }}
                disabled={!edit}
                variant="contained"
                component="label">
                Upload JSON File
                <input type="file" hidden onChange={handleFileChange} />
              </Button>
            </>
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
                  disabled={!edit}
                  checked={formData.active}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      active: !formData.active,
                    })
                  }
                  value={'push-notifications'}
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

          <Grid item container justify="flex-end" xs={12}>
            {edit && (
              <>
                <Button
                  variant="outlined"
                  className={classes.buttonSpacing}
                  onClick={() => handleCancelButton()}
                  color="primary">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  className={classes.buttonSpacing}
                  color="primary"
                  onClick={() => setOpenSaveDialog(true)}
                  startIcon={<Save />}>
                  Save
                </Button>
              </>
            )}
            {!edit && (
              <Button
                className={classes.buttonSpacing}
                onClick={handleToggleEdit}
                color="primary"
                startIcon={<Edit />}>
                Edit
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>
      <ConfirmationDialog
        open={openSaveDialog}
        handleClose={() => setOpenSaveDialog(false)}
        title={'Are you sure you want to proceed?'}
        description={'Notification settings changed'}
        buttonAction={() => onFormSubmit(formData)}
        buttonText={'Proceed'}
      />
    </Container>
  );
};

export default NotificationSettings;
