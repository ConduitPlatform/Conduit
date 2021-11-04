import React from 'react';
import SharedLayout from './sharedLayout';
import { Toc } from '@material-ui/icons';

const CmsLayout: React.FC<unknown> = ({ children }) => {
  const pathNames = ['/cms/schemas', '/cms/schemadata', '/cms/custom', '/cms/settings'];
  const labels = ['schemas', 'schemadata', 'custom', 'settings'];

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
