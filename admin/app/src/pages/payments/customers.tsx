import React, { ReactElement } from 'react';
import PaymentsLayout from '../../components/navigation/InnerLayouts/paymentsLayout';

const Customers = () => {
  return <div>Under construction...</div>;
};

Customers.getLayout = function getLayout(page: ReactElement) {
  return <PaymentsLayout>{page}</PaymentsLayout>;
};

export default Customers;
