import { Container } from '@material-ui/core';
import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';
import { FormSettingsConfig } from '../../models/forms/FormsModels';
import ConfirmationDialog from '../common/ConfirmationDialog';
import { FormSwitch } from '../common/RHFormComponents/RHFSwitch';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  innerGrid: {
    paddingLeft: theme.spacing(4),
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    width: '100%',
  },
}));

interface Props {
  handleSave: (data: FormSettingsConfig) => void;
  settingsData: FormSettingsConfig;
}

const FormsSettings: React.FC<Props> = ({ handleSave, settingsData }) => {
  const classes = useStyles();

  const [edit, setEdit] = useState<boolean>(false);
  // const [openSaveDialog, setOpenSaveDialog] = useState<boolean>(false);
  const methods = useForm<Props['settingsData']>({
    defaultValues: useMemo(() => {
      return settingsData;
    }, [settingsData]),
  });
  const { handleSubmit, reset, control } = methods;

  useEffect(() => {
    reset(settingsData);
  }, [settingsData, reset]);

  const isActive = useWatch({
    control,
    name: 'active',
  });

  const handleCancel = () => {
    reset();
  };

  const handleEditClick = () => {
    setEdit(true);
  };

  const onSubmit = (data: any) => {
    // const data = {
    //   active: settingsState.active,
    //   useAttachments: settingsData.useAttachments,
    // };
    setEdit(false);
    // handleSave(data);
    console.log(data);
    // setOpenSaveDialog(false);
  };

  return (
    <Container>
      <Paper className={classes.paper}>
        <form onSubmit={handleSubmit(onSubmit)} style={{}}>
          <Grid container>
            <Box
              width={'100%'}
              display={'inline-flex'}
              justifyContent={'space-between'}
              alignItems={'center'}>
              <Typography variant={'h6'}>Activate Forms Module</Typography>
              <FormSwitch control={control} disabled={!edit} name={'active'} />
            </Box>

            <Divider className={classes.divider} />

            <Grid container spacing={2} className={classes.innerGrid}>
              {isActive && (
                <Grid item xs={12}>
                  <Box
                    width={'100%'}
                    display={'inline-flex'}
                    justifyContent={'space-between'}
                    alignItems={'center'}>
                    <Typography variant={'h6'}>Use Attachments</Typography>
                    <FormSwitch control={control} disabled={!edit} name={'useAttachments'} />
                  </Box>
                </Grid>
              )}
            </Grid>
            {edit && (
              <Grid item container xs={12} justify={'flex-end'}>
                <Button
                  onClick={() => handleCancel()}
                  style={{ marginRight: 16 }}
                  color={'primary'}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  type="submit"
                  color="primary"
                  style={{ alignSelf: 'flex-end' }}
                  // onClick={() => setOpenSaveDialog(true)}
                >
                  Save
                </Button>
              </Grid>
            )}
            {!edit && (
              <Grid item container xs={12} justify={'flex-end'}>
                <Button
                  onClick={() => handleEditClick()}
                  style={{ marginRight: 16 }}
                  color={'primary'}>
                  Edit
                </Button>
              </Grid>
            )}
          </Grid>
        </form>
      </Paper>
      {/* <ConfirmationDialog
        open={openSaveDialog}
        handleClose={() => setOpenSaveDialog(false)}
        title={'Are you sure you want to proceed?'}
        description={'Forms settings changed'}
        buttonAction={save}
        buttonText={'Proceed'}
      /> */}
    </Container>
  );
};

export default FormsSettings;
