import React, { useEffect, useState } from 'react';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Checkbox from '@material-ui/core/Checkbox';
import Grid from '@material-ui/core/Grid';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormControl from '@material-ui/core/FormControl';
import ListItemText from '@material-ui/core/ListItemText';

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
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
    maxWidth: 300,
  },
}));

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

export default function RelationForm(props) {
  const { drawerData, onSubmit, onClose, selectedItem, ...rest } = props;
  const classes = useStyles();

  const [simpleData, setSimpleData] = useState({
    name: selectedItem ? selectedItem.name : '',
    type: '',
    select: selectedItem ? selectedItem.select : true,
    required: selectedItem ? selectedItem.required : false,
    isArray: selectedItem ? selectedItem.isArray : false,
    relation: selectedItem ? selectedItem.relation : [],
  });

  const handleFieldName = (event) => {
    setSimpleData({ ...simpleData, name: event.target.value });
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

  const handleFieldRelation = (event) => {
    setSimpleData({ ...simpleData, relation: event.target.value });
  };

  const handleSubmit = (event) => {
    onSubmit(event, simpleData);
    event.preventDefault();
  };

  useEffect(() => {
    setSimpleData({ ...simpleData, type: drawerData.type });
  }, [drawerData.open]);

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
        helperText={'It will appear in the entry editor'}
      />
      <Box width={'100%'}>
        <Grid container>
          <Grid item xs={12}>
            <Box width={'100%'} display={'inline-flex'} justifyContent={'space-between'} alignItems={'center'}>
              <Typography variant={'button'} style={{ width: '100%' }}>
                Required
              </Typography>
              <FormControlLabel
                control={<Switch checked={simpleData.required} onChange={handleFieldRequired} color="primary" />}
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
            <Box width={'100%'} display={'inline-flex'} justifyContent={'space-between'} alignItems={'center'}>
              <Typography variant={'button'} style={{ width: '100%' }}>
                Select
              </Typography>
              <FormControlLabel
                control={<Switch checked={simpleData.select} onChange={handleFieldSelect} color="primary" />}
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
            <Box width={'100%'} display={'inline-flex'} justifyContent={'space-between'} alignItems={'center'}>
              <Typography variant={'button'} style={{ width: '100%' }}>
                Array
              </Typography>
              <FormControlLabel
                control={<Checkbox checked={simpleData.isArray} onChange={handleFieldIsArray} color="primary" />}
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
      <FormControl className={classes.formControl} variant={'outlined'} fullWidth>
        <InputLabel id="field-type">Relation</InputLabel>
        <Select
          labelId="field-relation"
          id="field relation"
          label={'Relation'}
          multiple
          value={simpleData.relation}
          onChange={handleFieldRelation}
          renderValue={(selected) => selected.join(', ')}
          MenuProps={MenuProps}>
          {['Value1', 'Value2', 'Value3'].map((name) => (
            <MenuItem key={name} value={name}>
              <Checkbox checked={simpleData.relation.indexOf(name) > -1} color={'primary'}/>
              <ListItemText primary={name} />
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>Select the Relation type</FormHelperText>
      </FormControl>

      <Box display={'flex'} width={'100%'}>
        <Button variant="contained" color="primary" type="submit" style={{ marginRight: 16 }}>
          OK
        </Button>
        <Button variant="contained" onClick={onClose}>
          CANCEL
        </Button>
      </Box>
    </form>
  );
}
