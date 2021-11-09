import React from 'react';
import SharedLayout from './sharedLayout';
import { Payment } from '@material-ui/icons';

const PaymentsLayout: React.FC = ({ children }) => {
  const pathNames = [
    '/payments/customers',
    '/payments/products',
    '/payments/transactions',
    '/payments/subscriptions',
    '/payments/settings',
  ];
  const labels = ['customers', 'products', 'transactions', 'subscriptions', 'settings'];

  return (
    <SharedLayout
      title={'Payments'}
      labels={labels}
      pathNames={pathNames}
      swagger={'cms'}
      icon={<Payment />}>
      {children}
    </SharedLayout>
  );
};

export default PaymentsLayout;
