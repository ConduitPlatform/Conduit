import React from 'react';
import SharedLayout from './sharedLayout';
import { Notifications } from '@material-ui/icons';

const NotificationLayout: React.FC<unknown> = ({ children }) => {
  const pathNames = [
    '/push-notifications/view',
    '/push-notifications/send',
    '/push-notifications/settings',
  ];
  const labels = ['view', 'send', 'settings'];

  return (
    <SharedLayout
      title={'Notifications'}
      labels={labels}
      pathNames={pathNames}
      swagger={'cms'}
      icon={<Notifications />}>
      {children}
    </SharedLayout>
  );
};

export default NotificationLayout;
