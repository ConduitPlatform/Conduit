import React, { FC, useCallback, useState } from 'react';
import sharedClasses from '../../common/sharedClasses';
import { useForm } from 'react-hook-form';
import { Button, Container, Grid } from '@material-ui/core';
import { Customer } from '../../../models/payments/PaymentsModels';
import { FormInputText } from '../../common/RHFormComponents/RHFInputText';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import { AuthUser } from '../../../models/authentication/AuthModels';
import { asyncGetAuthUserData } from '../../../redux/slices/authenticationSlice';
import TableDialog from '../../common/TableDialog';
import SelectedElements from '../../common/SelectedElements';

interface Props {
  preloadedValues: Customer;
  handleSubmitData: (data: any) => void;
}

interface ICustomerForm {
  email: string;
  buyerName: string;
  phoneNumber: string;
  address: string;
  postCode: string;
}

const CustomerForm: FC<Props> = ({ preloadedValues, handleSubmitData }) => {
  const classes = sharedClasses();
  const dispatch = useAppDispatch();

  const methods = useForm<ICustomerForm>({ defaultValues: preloadedValues });
  const { handleSubmit, reset, control } = methods;

  const [drawer, setDrawer] = useState<boolean>(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const { users, count } = useAppSelector((state) => state.authenticationSlice.data.authUsers);

  const getData = useCallback(
    (params: { skip: number; limit: number; search: string; filter: string }) => {
      dispatch(asyncGetAuthUserData(params));
    },
    [dispatch]
  );

  const headers = [
    { title: '_id', sort: '_id' },
    { title: 'Email', sort: 'email' },
    { title: 'Active', sort: 'active' },
    { title: 'Verified', sort: 'isVerified' },
    { title: 'Registered At', sort: 'createdAt' },
  ];
  const formatData = (usersToFormat: AuthUser[]) => {
    return usersToFormat.map((u) => {
      return {
        _id: u._id,
        Email: u.email ? u.email : 'N/A',
        Active: u.active,
        Verified: u.isVerified,
        'Registered At': u.createdAt,
      };
    });
  };

  const onSubmit = (data: Customer) => {
    handleSubmitData({ ...data, userId: selectedUsers[0] });
    reset();
  };

  const onCancel = () => {
    setSelectedUsers([]);
    reset();
  };

  const removeSelectedUser = (i: number) => {
    const filteredArray = selectedUsers.filter((user, index) => index !== i);
    setSelectedUsers(filteredArray);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{}}>
      <Container className={classes.root} maxWidth="xl">
        <Grid container alignItems="center" className={classes.root} spacing={2}>
          <Grid item sm={12}>
            <FormInputText
              typeOfInput={'email'}
              requiredRules={'Email field is required'}
              pattern={/\A([\w+\-]\.?)+@[a-z\d\-]+(\.[a-z]+)*\.[a-z]+\z/i}
              errMsg={'Wrong email format'}
              name="email"
              control={control}
              label="Email"
            />
          </Grid>
          <Grid item sm={12}>
            <SelectedElements
              selectedElements={selectedUsers}
              handleButtonAction={() => setDrawer(true)}
              removeSelectedElement={removeSelectedUser}
              buttonText={'Add user'}
              header={'Selected user'}
            />
          </Grid>
          <Grid item sm={12}>
            <FormInputText
              name="buyerName"
              control={control}
              requiredRules={'Buyers name is required'}
              label="Buyer's Name"
            />
          </Grid>
          <Grid item sm={12}>
            <FormInputText
              name="phoneNumber"
              typeOfInput={'tel'}
              requiredRules={'Phone number is required'}
              control={control}
              label="Phone number"
            />
          </Grid>
          <Grid item sm={12}>
            <FormInputText
              name="address"
              requiredRules={'Address is required'}
              control={control}
              label="Address"
            />
          </Grid>
          <Grid item sm={12}>
            <FormInputText
              name="postCode"
              requiredRules={'Post code is required'}
              control={control}
              label="Post Code"
            />
          </Grid>
          <Grid container item xs={12} justify="space-around" style={{ marginTop: '35px' }}>
            <Grid item>
              <Button type="submit" variant="contained" color="primary" size="large">
                Save
              </Button>
            </Grid>
            <Grid item>
              <Button onClick={() => onCancel()} variant="contained" color="primary" size="large">
                Cancel
              </Button>
            </Grid>
          </Grid>
        </Grid>
      </Container>
      <TableDialog
        open={drawer}
        title={'Select users'}
        headers={headers}
        getData={getData}
        data={{ tableData: formatData(users), count: count }}
        handleClose={() => setDrawer(false)}
        buttonText={'Select user'}
        setExternalElements={setSelectedUsers}
        externalElements={selectedUsers}
      />
    </form>
  );
};

export default CustomerForm;
