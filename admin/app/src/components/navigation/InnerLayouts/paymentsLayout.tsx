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

  const labels = [
    { name: 'customers', id: 'customers' },
    { name: 'products', id: 'products' },
    { name: 'transactions', id: 'transactions' },
    { name: 'subscriptions', id: 'subscriptions' },
    { name: 'settings', id: 'settings' },
  ];

  return (
    <SharedLayout
      title={'Payments'}
      labels={labels}
      pathNames={pathNames}
      swagger={'payments'}
      icon={<Payment />}>
      {children}
    </SharedLayout>
  );
};

export default PaymentsLayout;
