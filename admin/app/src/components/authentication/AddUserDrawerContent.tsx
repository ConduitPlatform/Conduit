import React from 'react';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import SaveIcon from '@material-ui/icons/Save';
import addUser from '../../assets/svgs/addUser.svg';
import Grid from '@material-ui/core/Grid';
import Image from 'next/image';
import Container from '@material-ui/core/Container';
import { useForm } from 'react-hook-form';
import { FormInputText } from '../common/RHFormComponents/RHFInputText';

const useStyles = makeStyles(() => ({
  root: {
    flexGrow: 6,
    alignItems: 'center',
    justifyContent: 'center',
    justifyItems: 'center',
    justifySelf: 'center',
  },
  textField: {
    textAlign: 'center',
  },
  customizedButton: {
    position: 'absolute',
    left: '92%',
    top: '1%',
    color: 'gray',
  },
  centeredImg: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

interface Props {
  handleNewUserDispatch: (values: { password: string; email: string }) => void;
}

interface NewUserInputs {
  email: string;
  password: string;
}

const defaultValues = {
  email: '',
  password: '',
};

const NewUserModal: React.FC<Props> = ({ handleNewUserDispatch }) => {
  const classes = useStyles();
  const methods = useForm<NewUserInputs>({ defaultValues: defaultValues });
  const { handleSubmit, control } = methods;

  const onSubmit = (data: { password: string; email: string }) => {
    handleNewUserDispatch(data);
  };

  return (
    <div className={classes.root} style={{ marginTop: '150px' }}>
      <h3 style={{ textAlign: 'center' }}>Add a new user</h3>
      <Container className={classes.root} maxWidth="sm">
        <Grid container alignItems="center" className={classes.root} spacing={2}>
          <Grid item sm={12}>
            <FormInputText
              name="email"
              control={control}
              label="Username/Email"
              requiredRules="email/name is required!"
              typeOfInput={'text'}
            />
          </Grid>
          <Grid item sm={12}>
            <FormInputText
              name="password"
              control={control}
              label="Password"
              requiredRules="password is required!"
              typeOfInput={'password'}
              minimumLength={5}
              minLengthMsg={'The minimum length is 5 characters'}
            />
          </Grid>
          <Grid item>
            <Button
              onClick={handleSubmit(onSubmit)}
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              startIcon={<SaveIcon />}>
              Save
            </Button>
          </Grid>
        </Grid>
      </Container>

      <div className={classes.centeredImg}>
        <Image src={addUser} width="200px" alt="addUser" />
      </div>
    </div>
  );
};

export default NewUserModal;
