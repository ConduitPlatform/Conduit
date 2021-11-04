import React from 'react';
import SharedLayout from './sharedLayout';
import { Toc } from '@material-ui/icons';

const CmsLayout: React.FC<unknown> = ({ children }) => {
  const pathNames = ['/cms/schemas', '/cms/schemadata', '/cms/custom', '/cms/settings'];
  const labels = [
    { name: 'schemas', id: 'schemas' },
    { name: 'schema Data', id: 'schemadata' },
    { name: 'custom endpoints', id: 'custom' },
    { name: 'settings', id: 'settings' },
  ];

  return (
    <SharedLayout
      title={'CMS'}
      labels={labels}
      pathNames={pathNames}
      swagger={'cms'}
      icon={<Toc />}>
      {children}
    </SharedLayout>
  );
};

export default CmsLayout;
