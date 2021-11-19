import React from 'react';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import SaveIcon from '@material-ui/icons/Save';
import addUser from '../../assets/svgs/addUser.svg';
import Grid from '@material-ui/core/Grid';
import Image from 'next/image';
import Container from '@material-ui/core/Container';
import { FormProvider, useForm } from 'react-hook-form';
import { FormInputText } from '../common/FormComponents/FormInputText';

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

  const onSubmit = (data: { password: string; email: string }) => {
    handleNewUserDispatch(data);
  };

  return (
    <div>
      <Container className={classes.root} maxWidth="sm">
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <Grid container alignItems="center" className={classes.root} spacing={2}>
              <Grid item sm={12}>
                <FormInputText
                  name="email"
                  label="Username/Email"
                  rules={{ required: 'Username/mail is required' }}
                  typeOfInput={'text'}
                />
              </Grid>
              <Grid item sm={12}>
                <FormInputText
                  name="password"
                  label="Password"
                  rules={{ required: 'Password is required' }}
                  typeOfInput={'password'}
                />
              </Grid>
              <Grid item>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<SaveIcon />}>
                  Save
                </Button>
              </Grid>
            </Grid>
          </form>
        </FormProvider>
      </Container>

      <div className={classes.centeredImg}>
        <Image src={addUser} width="200px" alt="addUser" />
      </div>
    </div>
  );
};

export default NewUserModal;
