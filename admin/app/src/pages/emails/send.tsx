import React, { ReactElement, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import EmailsLayout from '../../components/navigation/InnerLayouts/emailsLayout';
import { asyncGetEmailTemplates } from '../../redux/slices/emailsSlice';

import SendEmailForm from '../../components/emails/SendEmailForm';

const SendEmail = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(asyncGetEmailTemplates({ skip: 0, limit: 100 }));
  }, [dispatch]);

  const { templateDocuments } = useAppSelector((state) => state.emailsSlice.data);

  return <SendEmailForm templates={templateDocuments} />;
};

SendEmail.getLayout = function getLayout(page: ReactElement) {
  return <EmailsLayout>{page}</EmailsLayout>;
};

export default SendEmail;
