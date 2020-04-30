import React, {useEffect, useState} from "react";
import slugify from "../../../../utils/slugify";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
  textField: {
    marginBottom: theme.spacing(1)
  },
  info: {
    width: '100%',
    fontSize: 14,
    marginBottom: theme.spacing(3)
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    padding: theme.spacing(2)
  },
}));

export default function BooleanForm(props) {
  const {drawerData, onSubmit, onClose, selectedItem, ...rest} = props;
  const classes = useStyles();

  const [booleanData, setBooleanData] = useState({
    name: selectedItem ? selectedItem.name : '',
    id: selectedItem ? selectedItem.id : '',
    placeholderFalse: selectedItem ? selectedItem.placeholderFalse : '',
    placeholderTrue: selectedItem ? selectedItem.placeholderTrue : '',
    type: ''
  });

  useEffect(() => {
    const slug = slugify(booleanData.name);
    setBooleanData({...booleanData, id: slug});
  }, [booleanData.name]);

  const handleFieldName = event => {
    setBooleanData({...booleanData, name: event.target.value});
  };

  const handleApiId = event => {
    setBooleanData({...booleanData, id: event.target.value});
  };

  const handleFalsePlaceholder = event => {
    setBooleanData({...booleanData, placeholderFalse: event.target.value});
  };

  const handleTruePlaceholder = event => {
    setBooleanData({...booleanData, placeholderTrue: event.target.value});
  };

  const handleSubmit = event => {
    onSubmit(event, booleanData);
    event.preventDefault();
  };

  useEffect(() => {
    setBooleanData({...booleanData, type: drawerData.type});
  }, [drawerData.open]);

  return (
    <form autoComplete="off" onSubmit={handleSubmit} className={classes.form} {...rest}>
      <TextField
        id="Field Name"
        label="Field Name"
        onChange={handleFieldName}
        value={booleanData.name}
        variant='outlined'
        className={classes.textField}
        fullWidth
        required
      />
      <Typography variant={"body2"} className={classes.info}>
        It will appear in the entry editor
      </Typography>
      <TextField
        id="API ID"
        label="API ID"
        onChange={handleApiId}
        value={booleanData.id}
        variant='outlined'
        className={classes.textField}
        fullWidth
        required
      />
      <Typography variant={"body2"} className={classes.info}>
        It's generated automatically based on the name and will appear in the API responses
      </Typography>
      <TextField
        id="False Placeholder"
        label="False Placeholder"
        onChange={handleFalsePlaceholder}
        placeholder={'false'}
        value={booleanData.placeholderFalse}
        variant='outlined'
        className={classes.textField}
        fullWidth
        required
      />
      <Typography variant={"body2"} className={classes.info}>
        Placeholder to appear in the editor
      </Typography>
      <TextField
        id="True Placeholder"
        label="True Placeholder"
        onChange={handleTruePlaceholder}
        placeholder={'true'}
        value={booleanData.placeholderTrue}
        variant='outlined'
        className={classes.textField}
        fullWidth
        required
      />
      <Typography variant={"body2"} className={classes.info}>
        Placeholder to appear in the editor
      </Typography>
      <Box display={'flex'} width={'100%'}>
        <Button variant="contained" color="primary" type="submit" style={{marginRight: 16}}>
          OK
        </Button>
        <Button variant="contained" onClick={onClose}>
          CANCEL
        </Button>
      </Box>
    </form>
  );
}
