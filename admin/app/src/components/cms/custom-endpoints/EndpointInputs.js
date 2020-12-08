import React, { Fragment } from 'react';
import {
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  IconButton,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import InputLocationEnum from '../../../models/InputLocationEnum';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';

const useStyles = makeStyles((theme) => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 180,
  },
}));

const EndpointInputs = ({
  selectedInputs,
  editMode,
  handleInputNameChange,
  handleInputTypeChange,
  handleInputLocationChange,
  handleRemoveInput,
}) => {
  const classes = useStyles();
  return selectedInputs.map((input, index) => (
    <Fragment key={`input-${index}`}>
      <Grid item xs={1} key={index}>
        <Typography>{index + 1}.</Typography>
      </Grid>
      <Grid item xs={3}>
        <TextField
          disabled={!editMode}
          value={input.name}
          onChange={(event) => handleInputNameChange(event, index)}></TextField>
      </Grid>
      <Grid item xs={4}>
        <FormControl className={classes.formControl}>
          <InputLabel>Type</InputLabel>
          <Select
            disabled={!editMode}
            native
            value={input.type}
            onChange={(event) => handleInputTypeChange(event, index)}>
            <option aria-label="None" value="" />
            <option value={'String'}>String</option>
            <option value={'Number'}>Number</option>
            <option value={'Boolean'}>Boolean</option>
            <option value={'ObjectId'}>ObjectId</option>
            <option value={'Date'}>Date</option>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={3}>
        <FormControl className={classes.formControl}>
          <Select
            disabled={!editMode}
            native
            value={input.location}
            onChange={(event) => handleInputLocationChange(event, index)}>
            <option aria-label="None" value="" />
            <option value={InputLocationEnum.QUERY_PARAMS}>Query params</option>
            <option value={InputLocationEnum.BODY}>Body</option>
            <option value={InputLocationEnum.URL_PARAMS}>URL</option>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={1}>
        <IconButton
          disabled={!editMode}
          size="small"
          onClick={() => handleRemoveInput(index)}>
          <RemoveCircleOutlineIcon />
        </IconButton>
      </Grid>
    </Fragment>
  ));
};

export default EndpointInputs;
