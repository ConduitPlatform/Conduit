import React, { ReactElement } from 'react';
import SettingsLayout from '../../components/navigation/InnerLayouts/settingsLayout';
import SdksTab from '../../components/settings/SdksTab';

const ClientSDKs = () => {
  return <SdksTab />;
};

ClientSDKs.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};

export default ClientSDKs;
