import React, { ReactElement, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import EmailsLayout from '../../components/navigation/InnerLayouts/emailsLayout';
import {
  asyncCreateNewEmailTemplate,
  asyncGetEmailTemplates,
  asyncSaveEmailTemplateChanges,
} from '../../redux/slices/emailsSlice';
import EmailTemplate from '../../components/emails/EmailTemplate';
import { EmailTemplateType } from '../../models/emails/EmailModels';

const Templates = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(asyncGetEmailTemplates());
  }, [dispatch]);

  const { templateDocuments } = useAppSelector((state) => state.emailsSlice.data);

  const saveTemplateChanges = (data: EmailTemplateType) => {
    const _id = data._id;
    const updatedData = {
      name: data.name,
      subject: data.subject,
      body: data.body,
      variables: data.variables,
    };

    dispatch(asyncSaveEmailTemplateChanges({ _id, data: updatedData }));
  };

  const createNewTemplate = (data: EmailTemplateType) => {
    const newData = {
      name: data.name,
      subject: data.subject,
      body: data.body,
      variables: data.variables,
    };
    dispatch(asyncCreateNewEmailTemplate(newData));
  };

  return (
    <EmailTemplate
      templatesData={templateDocuments}
      handleSave={saveTemplateChanges}
      handleCreate={createNewTemplate}
    />
  );
};

Templates.getLayout = function getLayout(page: ReactElement) {
  return <EmailsLayout>{page}</EmailsLayout>;
};

export default Templates;
