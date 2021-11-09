import React from 'react';
import { Toc } from '@material-ui/icons';
import SharedLayout from './sharedLayout';

const ChatLayout: React.FC = ({ children }) => {
  const pathNames = ['/chat/rooms', '/chat/settings'];
  const labels = [
    { name: 'Rooms', id: 'rooms' },
    { name: 'settings', id: 'settings' },
  ];

  return (
    <SharedLayout
      title={'Chat'}
      labels={labels}
      pathNames={pathNames}
      swagger={'chat'}
      icon={<Toc />}>
      {children}
    </SharedLayout>
  );
};

export default ChatLayout;
