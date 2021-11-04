import React from 'react';
import SharedLayout from './sharedLayout';
import { Email } from '@material-ui/icons';

const EmailsLayout: React.FC<unknown> = ({ children }) => {
  const pathNames = ['/emails/templates', '/emails/send', '/emails/provider'];
  const labels = ['templates', 'send', 'provider', 'settings'];

  return (
    <SharedLayout
      title={'Emails'}
      labels={labels}
      pathNames={pathNames}
      swagger={'cms'}
      icon={<Email />}>
      {children}
    </SharedLayout>
  );
};

export default EmailsLayout;
