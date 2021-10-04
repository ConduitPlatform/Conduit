import React, { ReactElement } from 'react';
import SettingsLayout from '../../components/navigation/InnerLayouts/settingsLayout';
import CreateNewUserTab from '../../components/settings/CreateNewUserTab';

const CreateUser = () => {
  return <CreateNewUserTab />;
};

CreateUser.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};

export default CreateUser;
