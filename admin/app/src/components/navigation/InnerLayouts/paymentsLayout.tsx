import React, { useEffect, useState } from 'react';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import { Box, Button } from '@material-ui/core';
import { useRouter } from 'next/router';
import sharedClasses from './sharedClasses';
import { Payment } from '@material-ui/icons';

const PaymentsLayout: React.FC<unknown> = ({ children }) => {
  const classes = sharedClasses();
  const router = useRouter();
  const [value, setValue] = useState(0);

  useEffect(() => {
    const pathNames = [
      '/payments/customers',
      '/payments/products',
      '/payments/transactions',
      '/payments/subscriptions',
      '/payments/settings',
    ];
    const index = pathNames.findIndex((pathname) => pathname === router.pathname);
    setValue(index);
  }, [router.pathname]);

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setValue(newValue);
    router.push(`${event.currentTarget.id}`, undefined, { shallow: false });
  };

  return (
    <Box p={4}>
      <Box className={classes.navBar}>
        <Typography className={classes.navContent} variant={'h4'}>
          Payments
          <a
            href={`${process.env.CONDUIT_URL}/swagger/#/payments`}
            target="_blank"
            rel="noreferrer"
            className={classes.swaggerButton}>
            <Button variant="outlined" endIcon={<Payment />}>
              SWAGGER
            </Button>
          </a>
        </Typography>
        <Tabs value={value} className={classes.navContent} onChange={handleChange}>
          <Tab label="Customers" id="customers" />
          <Tab label="Products" id="products" />
          <Tab label="Transactions" id="transactions" />
          <Tab label="Subscriptions" id="subscriptions" />
          <Tab label="Settings" id="settings" />
        </Tabs>
      </Box>
      <Box className={classes.content}>{children}</Box>
    </Box>
  );
};

export default PaymentsLayout;
