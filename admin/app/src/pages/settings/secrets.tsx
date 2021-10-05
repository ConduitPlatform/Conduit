import React, { ReactElement } from 'react';
import SettingsLayout from '../../components/navigation/InnerLayouts/settingsLayout';
import SecretsTab from '../../components/settings/SecretsTab';

const Secrets = () => {
  return <SecretsTab />;
};

Secrets.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};

export default Secrets;
