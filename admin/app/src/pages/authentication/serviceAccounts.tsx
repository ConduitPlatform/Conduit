import AuthenticationLayout from '../../components/navigation/InnerLayouts/authenticationLayout';
import ServiceAccountsTabs from '../../components/authentication/ServiceAccountsTabs';
import React, { ReactElement } from 'react';

const ServiceAccounts = () => {
  return <ServiceAccountsTabs />;
};

ServiceAccounts.getLayout = function getLayout(page: ReactElement) {
  return <AuthenticationLayout>{page}</AuthenticationLayout>;
};

export default ServiceAccounts;
