import React, { useEffect, useState } from 'react';
import Typography from '@material-ui/core/Typography';
import CustomTabs from '../components/common/CustomTabs';
import Box from '@material-ui/core/Box';
import SendEmailForm from '../components/emails/SendEmailForm';
import EmailTemplate from '../components/emails/EmailTemplate';
import { privateRoute } from '../components/utils/privateRoute';
import ProviderData from '../components/emails/ProviderData';
import { EmailSettings } from '../models/emails/EmailModels';
import {
  asyncCreateNewEmailTemplate,
  asyncGetEmailSettings,
  asyncGetEmailTemplates,
  asyncSaveEmailTemplateChanges,
  asyncUpdateEmailSettings,
} from '../redux/slices/emailsSlice';
import { useAppDispatch, useAppSelector } from '../redux/store';

const Emails: React.FC = () => {
  const dispatch = useAppDispatch();

  const { templateDocuments, settings } = useAppSelector(
    (state) => state.emailsSlice.data
  );

  const [selected, setSelected] = useState(0);

  useEffect(() => {
    dispatch(asyncGetEmailTemplates());
    dispatch(asyncGetEmailSettings());
  }, [dispatch]);

  useEffect(() => {
    if (settings && !settings.active) {
      setSelected(2);
    }
  }, [settings]);

  const tabs = [
    { title: 'Templates', isDisabled: settings ? !settings.active : true },
    { title: 'Send email', isDisabled: settings ? !settings.active : true },
    { title: 'Provider details' },
  ];

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setSelected(newValue);
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
    <Box p={2}>
      <Typography variant={'h4'}>Emails</Typography>
      <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
      <Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
        <EmailTemplate
          templatesData={templateDocuments}
          handleSave={saveTemplateChanges}
          handleCreate={createNewTemplate}
        />
      </Box>
      <Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>
        <SendEmailForm templates={templateDocuments} />
      </Box>
      <Box role="tabpanel" hidden={selected !== 2} id={`tabpanel-2`}>
        <ProviderData settings={settings} handleSave={saveSettings} />
      </Box>
    </Box>
  );
};

export default privateRoute(Emails);
