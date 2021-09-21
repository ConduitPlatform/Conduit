import React, { useEffect, useState } from 'react';
import Typography from '@material-ui/core/Typography';
import CustomTabs from '../components/common/CustomTabs';
import Box from '@material-ui/core/Box';
import SendEmailForm from '../components/emails/SendEmailForm';
import EmailTemplate from '../components/emails/EmailTemplate';
import { privateRoute } from '../components/utils/privateRoute';
import ProviderData from '../components/emails/ProviderData';
import Snackbar from '@material-ui/core/Snackbar';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import { makeStyles } from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import { EmailSettings } from '../models/emails/EmailModels';
import { SnackbarCloseReason } from '@material-ui/core/Snackbar/Snackbar';
import {
  asyncCreateNewEmailTemplate,
  asyncGetEmailSettings,
  asyncGetEmailTemplates,
  asyncSaveEmailTemplateChanges,
  asyncUpdateEmailSettings,
} from '../redux/slices/emailsSlice';
import { useAppDispatch, useAppSelector } from '../redux/store';

const useStyles = makeStyles((theme) => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
  snackBar: {
    maxWidth: '80%',
    width: 'auto',
  },
}));

const Emails: React.FC = () => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const { templateDocuments, settings } = useAppSelector(
    (state) => state.emailsSlice.data
  );
  const { loading, error } = useAppSelector((state) => state.emailsSlice.meta);

  const [selected, setSelected] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    dispatch(asyncGetEmailTemplates());
    dispatch(asyncGetEmailSettings());
  }, [dispatch]);

  useEffect(() => {
    if (settings && !settings.active) {
      setSelected(2);
    }
  }, [settings]);

  useEffect(() => {
    if (error) {
      setSnackbarOpen(true);
    } else {
      setSnackbarOpen(false);
    }
  }, [error]);

  const tabs = [
    { title: 'Templates', isDisabled: settings ? !settings.active : true },
    { title: 'Send email', isDisabled: settings ? !settings.active : true },
    { title: 'Provider details' },
  ];

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setSelected(newValue);
  };

  const snackbarAlert = () => {
    if (error) {
      return (
        <Alert variant={'filled'} severity="error">
          {error ? error : 'Something went wrong!'}
        </Alert>
      );
    } else {
      return undefined;
    }
  };

  const handleClose = (event: React.SyntheticEvent, reason: SnackbarCloseReason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const saveTemplateChanges = (data: any) => {
    const _id = data._id;
    const updatedData = {
      name: data.name,
      subject: data.subject,
      body: data.body,
      variables: data.variables,
    };

    dispatch(asyncSaveEmailTemplateChanges({ _id, data: updatedData }));
  };

  const createNewTemplate = (data: any) => {
    const newData = {
      name: data.name,
      subject: data.subject,
      body: data.body,
      variables: data.variables,
    };
    dispatch(asyncCreateNewEmailTemplate(newData));
  };

  const saveSettings = (data: EmailSettings) => {
    dispatch(asyncUpdateEmailSettings(data));
  };

  return (
    <>
      <Box p={2}>
        <Typography variant={'h4'}>Emails</Typography>
        <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
        <Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
          <EmailTemplate
            templatesData={templateDocuments}
            error={error}
            handleSave={saveTemplateChanges}
            handleCreate={createNewTemplate}
          />
        </Box>
        <Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>
          <SendEmailForm templates={templateDocuments} />
        </Box>
        <Box role="tabpanel" hidden={selected !== 2} id={`tabpanel-2`}>
          <ProviderData settings={settings} handleSave={saveSettings} error={error} />
        </Box>
      </Box>
      <Snackbar
        open={snackbarOpen}
        className={classes.snackBar}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snackbarAlert()}
      </Snackbar>
      <Backdrop open={loading} className={classes.backdrop}>
        <CircularProgress color="secondary" />
      </Backdrop>
    </>
  );
};

export default privateRoute(Emails);
