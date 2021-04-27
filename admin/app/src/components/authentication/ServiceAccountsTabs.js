import {
  Container,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import DeleteIcon from '@material-ui/icons/Delete';
import Button from '@material-ui/core/Button';
import React, { useEffect, useState } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import {
  createServiceAccount,
  deleteServiceAccounts,
  getServiceAccounts,
  refreshServiceAccount,
} from '../../http/requests';
import moment from 'moment';
import ConfirmationDialog from '../common/ConfirmationDialog';
import GetServiceAccountToken from './GetServiceAccountToken';
import RefreshIcon from '@material-ui/icons/Refresh';
import CreateServiceAccount from './CreateServiceAccount';

const useStyles = makeStyles({
  table: {
    maxWidth: 650,
  },
});

const ServiceAccountsTabs = () => {
  const classes = useStyles();

  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState('');
  const [tokenDialog, setTokenDialog] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [createdService, setCreatedService] = useState(null);
  const [serviceAccounts, setServiceAccounts] = useState([]);

  useEffect(() => {
    fetchServiceAccounts();
  }, []);

  const handleDeleteClick = (_id) => {
    setServiceId(_id);
    setConfirmation(true);
  };

  const handleDeletion = async () => {
    handleCloseConfirmation();
    try {
      await deleteServiceAccounts(serviceId);
      fetchServiceAccounts();
    } catch (e) {
      console.log(e);
    }
  };

  const handleGenerateNew = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleCloseTokenDialog = () => {
    setTokenDialog(false);
    setCreatedService(null);
  };

  const handleCloseConfirmation = () => {
    setServiceId(null);
    setConfirmation(false);
  };

  const handleCreate = async () => {
    if (name) {
      try {
        const response = await createServiceAccount(name);
        handleClose();
        setTokenDialog(true);
        setCreatedService(response.data);
        fetchServiceAccounts();
      } catch (e) {
        console.log(e);
      }
    }
  };

  const handleRefresh = async (serviceId) => {
    try {
      const response = await refreshServiceAccount(serviceId);
      handleClose();
      setTokenDialog(true);
      setCreatedService(response.data);
      fetchServiceAccounts();
    } catch (e) {
      console.log(e);
    }
  };

  const fetchServiceAccounts = async () => {
    try {
      const axiosResponse = await getServiceAccounts();
      if (axiosResponse.data && axiosResponse.data.services) {
        const services = axiosResponse.data.services;
        setServiceAccounts(services);
      }
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <>
      <Container>
        <Grid container>
          <Grid item xs={12}>
            <Typography variant={'h6'}>All available Service Accounts</Typography>
            <Typography variant={'subtitle1'}>
              Create, delete, refresh your Service Accounts . . .
            </Typography>
          </Grid>
          <Grid item xs={10}>
            <TableContainer>
              <Table className={classes.table}>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Token</TableCell>
                    <TableCell>Active</TableCell>
                    <TableCell>Created At</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {serviceAccounts.map((service, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant={'caption'}>{service.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant={'caption'}>
                          {Array(service.hashedToken.length + 1).join('*')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant={'caption'}>
                          {service.active ? 'TRUE' : 'FALSE'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant={'caption'}>
                          {moment(service.createdAt).format('DD/MM/YYYY')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton onClick={() => handleDeleteClick(service._id)}>
                          <DeleteIcon />
                        </IconButton>
                        <IconButton onClick={() => handleRefresh(service._id)}>
                          <RefreshIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          <Grid item xs={2}>
            <Button variant={'contained'} color={'primary'} onClick={handleGenerateNew}>
              Generate new Service Account
            </Button>
          </Grid>
        </Grid>
      </Container>
      <ConfirmationDialog
        open={confirmation}
        handleClose={handleCloseConfirmation}
        buttonAction={handleDeletion}
        buttonText={'Delete'}
        title={'Delete selected Service Account'}
      />
      <GetServiceAccountToken
        open={tokenDialog}
        handleClose={handleCloseTokenDialog}
        token={createdService ? createdService.token : ''}
      />
      <CreateServiceAccount
        open={open}
        name={name}
        setName={setName}
        handleClose={handleClose}
        handleCreate={handleCreate}
      />
    </>
  );
};

export default ServiceAccountsTabs;
