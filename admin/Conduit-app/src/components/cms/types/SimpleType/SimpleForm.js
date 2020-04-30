import React, {useEffect, useState} from "react";
import slugify from "../../../../utils/slugify";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    padding: theme.spacing(2)
  },
  textField: {
    marginBottom: theme.spacing(1)
  },
  info: {
    width: '100%',
    fontSize: 14,
    marginBottom: theme.spacing(3)
  }
}));

export default function SimpleForm(props) {
  const {drawerData, onSubmit, onClose, selectedItem, ...rest} = props;
  const classes = useStyles();

  const [simpleData, setSimpleData] = useState({
    name: selectedItem ? selectedItem.name : '',
    id: selectedItem ? selectedItem.id : '',
    placeholder: selectedItem ? selectedItem.placeholder : '',
    type: ''
  });

  useEffect(() => {
    const slug = slugify(simpleData.name);
    setSimpleData({...simpleData, id: slug});
  }, [simpleData.name]);

  const handleFieldName = event => {
    setSimpleData({...simpleData, name: event.target.value});
  };

  const handleApiId = event => {
    setSimpleData({...simpleData, id: event.target.value});
  };

  const handleFieldPlaceholder = event => {
    setSimpleData({...simpleData, placeholder: event.target.value});
  };

  const handleSubmit = event => {
    onSubmit(event, simpleData);
    event.preventDefault();
  };

  useEffect(() => {
    setSimpleData({...simpleData, type: drawerData.type});
  }, [drawerData.open]);

  return (
    <form autoComplete="off" onSubmit={handleSubmit} className={classes.form} {...rest}>
      <TextField
        id="Field Name"
        label="Field Name"
        onChange={handleFieldName}
        value={simpleData.name}
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
        value={simpleData.id}
        variant='outlined'
        className={classes.textField}
        fullWidth
        required
      />
      <Typography variant={"body2"} className={classes.info}>
        It's generated automatically based on the name and will appear in the API responses
      </Typography>
      <TextField
        id="Field Placeholder"
        label="Field Placeholder"
        onChange={handleFieldPlaceholder}
        value={simpleData.placeholder}
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
