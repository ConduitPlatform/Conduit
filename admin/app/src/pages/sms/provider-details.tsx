import React, { ReactElement } from 'react';
import SMSLayout from '../../components/navigation/InnerLayouts/smsLayout';
import SmsProviderDetails from '../../components/sms/SmsProviderDetails';

const Send = () => {
  return <SmsProviderDetails />;
};

Send.getLayout = function getLayout(page: ReactElement) {
  return <SMSLayout> {page} </SMSLayout>;
};

export default Send;
