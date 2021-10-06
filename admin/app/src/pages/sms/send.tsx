import React, { ReactElement } from 'react';
import SMSLayout from '../../components/navigation/InnerLayouts/smsLayout';
import SendSms from '../../components/sms/SendSms';

const Send = () => {
  return <SendSms />;
};

Send.getLayout = function getLayout(page: ReactElement) {
  return <SMSLayout>{page}</SMSLayout>;
};

export default Send;
