import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import Switch from '@material-ui/core/Switch';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import React, { useState } from 'react';

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

export default function SimpleForm({
  drawerData,
  readOnly,
  onSubmit,
  onClose,
  selectedItem,
  ...rest
}) {
  const classes = useStyles();

  const [simpleData, setSimpleData] = useState({
    name: selectedItem ? selectedItem.name : '',
    default: selectedItem ? selectedItem.default : '',
    type: selectedItem ? selectedItem.type : drawerData.type,
    unique: selectedItem ? selectedItem.unique : false,
    select: selectedItem ? selectedItem.select : true,
    required: selectedItem ? selectedItem.required : false,
    isArray: selectedItem ? selectedItem.isArray : false,
  });

  const handleFieldName = (event) => {
    setSimpleData({ ...simpleData, name: event.target.value });
  };

  const handleFieldDefault = (event) => {
    setSimpleData({ ...simpleData, default: event.target.value });
  };

  const handleFieldUnique = () => {
    setSimpleData({ ...simpleData, unique: !simpleData.unique });
  };

  const handleFieldRequired = () => {
    setSimpleData({ ...simpleData, required: !simpleData.required });
  };

  const handleFieldSelect = () => {
    setSimpleData({ ...simpleData, select: !simpleData.select });
  };

  const handleFieldIsArray = () => {
    setSimpleData({ ...simpleData, isArray: !simpleData.isArray });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(simpleData);
  };

  return (
    <form autoComplete="off" onSubmit={handleSubmit} className={classes.form} {...rest}>
      <TextField
        id="Field Name"
        label="Field Name"
        onChange={handleFieldName}
        value={simpleData.name}
        variant="outlined"
        className={classes.textField}
        fullWidth
        required
        InputProps={{
          readOnly: readOnly && !!selectedItem,
        }}
        helperText={'It will appear in the entry editor'}
      />
      <TextField
        id="field-default-value"
        label="Field default value"
        onChange={handleFieldDefault}
        value={simpleData.default}
        variant="outlined"
        className={classes.textField}
        fullWidth
        helperText={'Default value of this field'}
      />
      <Box width={'100%'}>
        <Grid container>
          <Grid item xs={12}>
            <Box
              width={'100%'}
              display={'inline-flex'}
              justifyContent={'space-between'}
              alignItems={'center'}>
              <Typography variant={'button'} style={{ width: '100%' }}>
                Unique field
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={simpleData.unique}
                    onChange={handleFieldUnique}
                    color="primary"
                  />
                }
                label=""
              />
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Typography variant={'subtitle1'} className={classes.info}>
              {"If active, this field's value must be unique"}
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
                Required
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={simpleData.required}
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
                    checked={simpleData.select}
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
                    checked={simpleData.isArray}
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
      </Box>

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
