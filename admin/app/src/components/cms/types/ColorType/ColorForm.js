import React, { useEffect, useState } from 'react';
import slugify from '../../../../utils/slugify';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';

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
  },
}));

export default function ColorForm(props) {
  const { drawerData, onSubmit, onClose, selectedItem, ...rest } = props;
  const classes = useStyles();

  const [colorData, setColorData] = useState({
    name: selectedItem ? selectedItem.name : '',
    id: selectedItem ? selectedItem.id : '',
    type: '',
  });

  useEffect(() => {
    const slug = slugify(colorData.name);
    setColorData({ ...colorData, id: slug });
  }, [colorData, colorData.name]);

  const handleFieldName = (event) => {
    setColorData({ ...colorData, name: event.target.value });
  };

  const handleApiId = (event) => {
    setColorData({ ...colorData, id: event.target.value });
  };

  const handleSubmit = (event) => {
    onSubmit(event, colorData);
    event.preventDefault();
  };

  useEffect(() => {
    setColorData({ ...colorData, type: drawerData.type });
  }, [colorData, drawerData.open, drawerData.type]);

  return (
    <form autoComplete="off" onSubmit={handleSubmit} className={classes.form} {...rest}>
      <TextField
        id="Field Name"
        label="Field Name"
        onChange={handleFieldName}
        value={colorData.name}
        variant="outlined"
        className={classes.textField}
        fullWidth
        required
      />
      <Typography variant={'body2'} className={classes.info}>
        It will appear in the entry editor
      </Typography>
      <TextField
        id="API ID"
        label="API ID"
        onChange={handleApiId}
        value={colorData.id}
        variant="outlined"
        className={classes.textField}
        fullWidth
        required
      />
      <Typography variant={'body2'} className={classes.info}>
        {`It's generated automatically based on the name and will appear in the API
        responses`}
      </Typography>
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
