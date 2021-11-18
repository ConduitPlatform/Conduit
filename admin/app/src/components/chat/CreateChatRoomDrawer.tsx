import React, { FC, useCallback, useState } from 'react';
import { Box, Button, TextField } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import DrawerWrapper from '../navigation/SideDrawerWrapper';
import { makeStyles } from '@material-ui/core/styles';
import TableDialog from '../common/TableDialog';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { asyncGetAuthUserData } from '../../redux/slices/authenticationSlice';
import { AuthUser } from '../../models/authentication/AuthModels';
import SelectedElements from '../common/SelectedElements';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(6),
  },
  createContainer: {
    display: 'flex',
    alignItems: 'center',
    textAlign: 'start',
    marginBottom: theme.spacing(2),
  },
  createTitle: {
    marginRight: theme.spacing(1),
  },
  saveButton: {
    marginRight: theme.spacing(1),
  },
  selectedElements: {
    margin: theme.spacing(2, 0),
  },
}));

interface ICreateChatRoom {
  name: string;
  participants: string[];
}

interface Props {
  open: boolean;
  handleCreateChatRoom: (data: ICreateChatRoom) => void;
  closeDrawer: () => void;
}

const CreateChatRoomDrawer: FC<Props> = ({ open, handleCreateChatRoom, closeDrawer }) => {
  const classes = useStyles();
  const dispatch = useAppDispatch();

  const initialInputData = {
    name: '',
    participants: [],
  };
  const [inputData, setInputData] = useState<ICreateChatRoom>(initialInputData);

  const handleCancel = () => {
    setInputData(initialInputData);
    closeDrawer();
  };

  const handleSave = () => {
    handleCreateChatRoom(inputData);
    setInputData(initialInputData);
    closeDrawer();
  };

  const [usersDialog, setUsersDialog] = useState<boolean>(false);

  const { users, count } = useAppSelector((state) => state.authenticationSlice.data.authUsers);

  const getData = useCallback(
    (params: { skip: number; limit: number; search: string; filter: string }) => {
      dispatch(asyncGetAuthUserData(params));
    },
    [dispatch]
  );

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

  const headers = [
    { title: '_id', sort: '_id' },
    { title: 'Email', sort: 'email' },
    { title: 'Active', sort: 'active' },
    { title: 'Verified', sort: 'isVerified' },
    { title: 'Registered At', sort: 'createdAt' },
  ];

  const removeSelectedUser = (i: number) => {
    const filteredArray = inputData.participants.filter((user, index) => index !== i);
    setInputData({ ...inputData, participants: filteredArray });
  };

  return (
    <>
      <DrawerWrapper open={open} closeDrawer={() => closeDrawer()} width={256}>
        <Box className={classes.root}>
          <Box className={classes.createContainer}>
            <Typography variant="h6" className={classes.createTitle}>
              Create chat room
            </Typography>
          </Box>
          <TextField
            variant="outlined"
            label="Name"
            value={inputData.name}
            onChange={(event) => {
              setInputData({
                ...inputData,
                name: event.target.value,
              });
            }}
          />
          <SelectedElements
            selectedElements={inputData.participants}
            handleButtonAction={() => setUsersDialog(true)}
            removeSelectedElement={removeSelectedUser}
            buttonText={'Add participants'}
            header={'Selected participants'}
            className={classes.selectedElements}
          />
          <Box>
            <Button
              variant="contained"
              color="primary"
              className={classes.saveButton}
              onClick={() => handleSave()}>
              Save
            </Button>
            <Button variant="outlined" onClick={() => handleCancel()}>
              Cancel
            </Button>
          </Box>
        </Box>
      </DrawerWrapper>
      <TableDialog
        open={usersDialog}
        title={'Select users'}
        headers={headers}
        getData={getData}
        data={{ tableData: formatData(users), count: count }}
        handleClose={() => setUsersDialog(false)}
        buttonText={'Select participants'}
        setExternalElements={(values) => {
          setInputData({
            ...inputData,
            participants: values,
          });
        }}
        externalElements={inputData.participants}
      />
    </>
  );
};

export default CreateChatRoomDrawer;
