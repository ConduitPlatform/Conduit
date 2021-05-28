import { Layout } from '../components/navigation/Layout';
import React, { useEffect, useState } from 'react';
import Typography from '@material-ui/core/Typography';
import CustomTabs from '../components/common/CustomTabs';
import Box from '@material-ui/core/Box';
import SendEmailForm from '../components/emails/SendEmailForm';
import EmailTemplate from '../components/emails/EmailTemplate';
import { privateRoute } from '../components/utils/privateRoute';
import ProviderData from '../components/emails/ProviderData';
import { useDispatch, useSelector } from 'react-redux';
import { getEmailTemplates } from '../redux/thunks';
import Snackbar from '@material-ui/core/Snackbar';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import { makeStyles } from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import {
  createNewEmailTemplate,
  getEmailSettings,
  saveEmailTemplateChanges,
  sendEmailThunk,
  updateEmailSettings,
} from '../redux/thunks/emailsThunk';

const useStyles = makeStyles((theme) => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
  },
  snackBar: {
    maxWidth: '80%',
    width: 'auto',
  },
}));

const Emails = () => {
  const classes = useStyles();
  const dispatch = useDispatch();

  const { data, loading, error } = useSelector((state) => state.emailsPageReducer);
  const [selected, setSelected] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    dispatch(getEmailTemplates());
    dispatch(getEmailSettings());
  }, [dispatch]);

  useEffect(() => {
    if (data.settings && !data.settings.active) {
      setSelected(2);
    }
  }, [data.settings]);

  useEffect(() => {
    if (error) {
      setSnackbarOpen(true);
    } else {
      setSnackbarOpen(false);
    }
  }, [error]);

  const tabs = [
    { title: 'Templates', isDisabled: data.settings ? !data.settings.active : true },
    { title: 'Send email', isDisabled: data.settings ? !data.settings.active : true },
    { title: 'Provider details' },
  ];

  const handleChange = (event, newValue) => {
    setSelected(newValue);
  };

  const snackbarAlert = () => {
    if (error) {
      return (
        <Alert variant={'filled'} onClose={handleClose} severity="error">
          {error?.data?.error ? error.data.error : 'Something went wrong!'}
        </Alert>
      );
    } else {
      return undefined;
    }
  };

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const saveTemplateChanges = (data) => {
    const _id = data._id;
    const updatedData = {
      name: data.name,
      subject: data.subject,
      body: data.body,
      variables: data.variables,
    };
    dispatch(saveEmailTemplateChanges(_id, updatedData));
  };

  const createNewTemplate = (data) => {
    const newData = {
      name: data.name,
      subject: data.subject,
      body: data.body,
      variables: data.variables,
    };
    dispatch(createNewEmailTemplate(newData));
  };

  const saveSettings = (data) => {
    dispatch(updateEmailSettings(data));
  };

  return (
    <Layout itemSelected={4}>
      <Box p={2}>
        <Typography variant={'h4'}>Emails</Typography>
        <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
        <Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
          <EmailTemplate
            templatesData={data.templateDocuments}
            error={error}
            handleSave={saveTemplateChanges}
            handleCreate={createNewTemplate}
          />
        </Box>
        <Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>
          <SendEmailForm templates={data.templateDocuments} />
        </Box>
        <Box role="tabpanel" hidden={selected !== 2} id={`tabpanel-2`}>
          <ProviderData
            settings={data.settings}
            handleSave={saveSettings}
            error={error}
          />
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
    </Layout>
  );
};

export default privateRoute(Emails);
