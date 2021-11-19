import React, { FC, useCallback, useState } from 'react';
import sharedClasses from '../../common/sharedClasses';
import { FormProvider, useForm } from 'react-hook-form';
import { Button, Grid } from '@material-ui/core';
import { Customer } from '../../../models/payments/PaymentsModels';
import { FormInputText } from '../../common/FormComponents/FormInputText';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import { AuthUser } from '../../../models/authentication/AuthModels';
import { asyncGetAuthUserData } from '../../../redux/slices/authenticationSlice';
import TableDialog from '../../common/TableDialog';
import SelectedElements from '../../common/SelectedElements';
import { camelCase, startCase } from 'lodash';

interface Props {
  preloadedValues: Customer;
  handleSubmitData: (data: Customer) => void;
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
  const { reset } = methods;

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

  const inputs = ['email', 'buyerName', 'phoneNumber', 'address', 'postCode'];

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} style={{}}>
        <Grid container spacing={2}>
          <Grid item sm={12}>
            <SelectedElements
              selectedElements={selectedUsers}
              handleButtonAction={() => setDrawer(true)}
              removeSelectedElement={removeSelectedUser}
              buttonText={'Add user'}
              header={'Selected user'}
            />
          </Grid>
          {inputs.map((input, index) => (
            <Grid key={index} item sm={12}>
              <FormInputText
                name={input}
                rules={{ required: `${input} is required` }}
                label={startCase(camelCase(input))}
              />
            </Grid>
          ))}
          <Grid container item>
            <Grid item className={classes.marginRight}>
              <Button variant="outlined" onClick={() => onCancel()}>
                Cancel
              </Button>
            </Grid>
            <Grid item>
              <Button variant="contained" color="primary" type="submit">
                Save
              </Button>
            </Grid>
          </Grid>
        </Grid>
        <TableDialog
          open={drawer}
          singleSelect
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
    </FormProvider>
  );
};

export default CustomerForm;
