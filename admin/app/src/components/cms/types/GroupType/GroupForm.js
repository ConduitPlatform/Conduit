import React, { useEffect, useState } from 'react';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Checkbox from '@material-ui/core/Checkbox';

const useStyles = makeStyles((theme) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    padding: theme.spacing(2),
  },
  textField: {
    marginBottom: theme.spacing(1),
  },
  info: {
    width: '100%',
    fontSize: 14,
    marginBottom: theme.spacing(3),
    opacity: '0.5',
  },
}));

export default function GroupForm({
  drawerData,
  readOnly,
  onSubmit,
  onClose,
  selectedItem,
  ...rest
}) {
  const classes = useStyles();

  const [groupData, setGroupData] = useState({
    name: selectedItem ? selectedItem.name : '',
    content: selectedItem ? selectedItem.content : [],
    type: '',
    unique: selectedItem ? selectedItem.unique : false,
    select: selectedItem ? selectedItem.select : true,
    required: selectedItem ? selectedItem.required : false,
    isArray: selectedItem ? selectedItem.isArray : false,
  });

  //TODO remove: produces maximum callstack
  // useEffect(() => {
  //   setGroupData({ ...groupData, type: drawerData.type });
  // }, [drawerData.open, drawerData.type, groupData]);

  const handleFieldName = (event) => {
    setGroupData({ ...groupData, name: event.target.value });
  };

  const handleFieldRequired = () => {
    setGroupData({ ...groupData, required: !groupData.required });
  };

  const handleFieldSelect = () => {
    setGroupData({ ...groupData, select: !groupData.select });
  };

  const handleFieldIsArray = () => {
    setGroupData({ ...groupData, isArray: !groupData.isArray });
  };

  const handleSubmit = (event) => {
    onSubmit(event, groupData);
    event.preventDefault();
  };

  return (
    <form autoComplete="off" onSubmit={handleSubmit} className={classes.form} {...rest}>
      <TextField
        id="Field Name"
        label="Field Name"
        onChange={handleFieldName}
        value={groupData.name}
        variant="outlined"
        className={classes.textField}
        fullWidth
        required
        InputProps={{
          readOnly: readOnly && !!selectedItem,
        }}
        helperText={'It will appear in the entry editor'}
      />

      <Grid container>
        <Grid item xs={12}>
          <Box
            width={'100%'}
            display={'inline-flex'}
            justifyContent={'space-between'}
            alignItems={'center'}>
            <Typography variant={'button'} style={{ width: '100%' }}>
              Required
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={groupData.required}
                  onChange={handleFieldRequired}
                  color="primary"
                />
              }
              label=""
            />
          </Box>
        </Grid>
        <Grid item xs={12}>
          <Typography variant={'body2'} className={classes.info}>
            If active, this field will be required
          </Typography>
        </Grid>
      </Grid>

      <Grid container>
        <Grid item xs={12}>
          <Box
            width={'100%'}
            display={'inline-flex'}
            justifyContent={'space-between'}
            alignItems={'center'}>
            <Typography variant={'button'} style={{ width: '100%' }}>
              Select
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={groupData.select}
                  onChange={handleFieldSelect}
                  color="primary"
                />
              }
              label=""
            />
          </Box>
        </Grid>
        <Grid item xs={12}>
          <Typography variant={'body2'} className={classes.info}>
            This option defines if the field you be returned from the database
          </Typography>
        </Grid>
      </Grid>

      <Grid container>
        <Grid item xs={12}>
          <Box
            width={'100%'}
            display={'inline-flex'}
            justifyContent={'space-between'}
            alignItems={'center'}>
            <Typography variant={'button'} style={{ width: '100%' }}>
              Array
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={groupData.isArray}
                  onChange={handleFieldIsArray}
                  color="primary"
                />
              }
              label=""
            />
          </Box>
        </Grid>
        <Grid item xs={12}>
          <Typography variant={'body2'} className={classes.info}>
            Activate this option if you want your field to be of type Array
          </Typography>
        </Grid>
      </Grid>

      <Box display={'flex'} width={'100%'}>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          style={{ marginRight: 16 }}>
          OK
        </Button>
        <Button variant="contained" onClick={onClose}>
          CANCEL
        </Button>
      </Box>
    </form>
  );
}
