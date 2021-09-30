import { makeStyles } from '@material-ui/core';
import authenticationLayout from '../../components/navigation/InnerLayouts/authenticationLayout';
import ServiceAccountsTabs from '../../components/authentication/ServiceAccountsTabs';

const useStyles = makeStyles((theme) => ({
  root: {
    '& > *': {
      margin: theme.spacing(0.5),
    },
    marginBottom: '3px',
  },
}));

const ServiceAccounts = () => {
  return (
    <div>
      <ServiceAccountsTabs />
    </div>
  );
};

ServiceAccounts.Layout = authenticationLayout;

export default ServiceAccounts;
