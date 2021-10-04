import React, { ReactElement } from 'react';
import SettingsLayout from '../../components/navigation/InnerLayouts/settingsLayout';
import CoreSettingsTab from '../../components/settings/CoreSettingsTab';

const CoreSettings = () => {
  return <CoreSettingsTab />;
};

CoreSettings.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};

export default CoreSettings;
