import React from 'react';
import SharedLayout from './sharedLayout';
import { Email } from '@material-ui/icons';

const EmailsLayout: React.FC = ({ children }) => {
  const pathNames = ['/emails/templates', '/emails/send', '/emails/provider'];

  const labels = [
    { name: 'templates', id: 'templates' },
    { name: 'send', id: 'send' },
    { name: 'provider', id: 'provider' },
    { name: 'settings', id: 'settings' },
  ];

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
