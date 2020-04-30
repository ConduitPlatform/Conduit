import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';
import SimpleForm from './types/SimpleType/SimpleForm';
import ColorForm from './types/ColorType/ColorForm';
import BooleanForm from './types/BooleanType/BooleanForm';
import SelectForm from './types/SelectType/SelectForm';
import GroupForm from './types/GroupType/GroupForm';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';

const useStyles = makeStyles((theme) => ({
  drawerPaper: {
    width: '25%',
    alignItems: 'center',
  },
  duplicateId: {
    color: 'red',
    marginBottom: theme.spacing(2),
  },
  title: {
    width: '100%',
    padding: theme.spacing(2),
    fontWeight: 'bold',
    borderBottom: '1px solid',
    borderColor: theme.palette.primary.main,
  },
}));

export default function BuildTypesDrawer(props) {
  const { drawerData, onSubmit, onClose, selectedItem, duplicateId, ...rest } = props;
  const classes = useStyles();

  const handleForm = (data) => {
    switch (data.type) {
      case 'Text':
        return <SimpleForm onSubmit={onSubmit} drawerData={drawerData} onClose={onClose} selectedItem={selectedItem} />;
      case 'Number':
        return <SimpleForm onSubmit={onSubmit} drawerData={drawerData} onClose={onClose} selectedItem={selectedItem} />;
      case 'Date':
        return <SimpleForm onSubmit={onSubmit} drawerData={drawerData} onClose={onClose} selectedItem={selectedItem} />;
      case 'Color':
        return <ColorForm onSubmit={onSubmit} drawerData={drawerData} onClose={onClose} selectedItem={selectedItem} />;
      case 'Boolean':
        return <BooleanForm onSubmit={onSubmit} drawerData={drawerData} onClose={onClose} selectedItem={selectedItem} />;
      case 'Select':
        return <SelectForm onSubmit={onSubmit} drawerData={drawerData} onClose={onClose} selectedItem={selectedItem} />;
      case 'Group':
        return <GroupForm onSubmit={onSubmit} drawerData={drawerData} onClose={onClose} selectedItem={selectedItem} />;
      default:
        return (
          <Box>
            <Typography>Something went wrong</Typography>
            <Button onClick={onClose} color="primary">
              Go Back
            </Button>
          </Box>
        );
    }
  };

  return (
    <Drawer anchor="right" open={drawerData.open} classes={{ paper: classes.drawerPaper }} className={classes.drawer} {...rest}>
      <Typography variant={'subtitle1'} className={classes.title}>
        Configuration of {drawerData.type} field
      </Typography>
      {handleForm(drawerData)}
      {duplicateId && (
        <Box textAlign={'center'}>
          <Typography variant={'button'} className={classes.duplicateId}>
            Warning! Duplicate ID
          </Typography>
          <Typography variant={'body1'}>Please provide a unique ID</Typography>
        </Box>
      )}
    </Drawer>
  );
}
