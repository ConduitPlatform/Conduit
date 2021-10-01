import React, { ReactElement } from 'react';
import CmsLayout from '../../components/navigation/InnerLayouts/cmsLayout';

const Settings = () => {
  return <div>Under construction...</div>;
};

Settings.getLayout = function getLayout(page: ReactElement) {
  return <CmsLayout>{page}</CmsLayout>;
};

export default Settings;
