import React, { useState } from 'react';
import DataTable from '../common/DataTable';
import Container from '@material-ui/core/Container';
import Box from '@material-ui/core/Box';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import ToggleButton from '@material-ui/lab/ToggleButton';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  toggleButton: {
    '&.Mui-selected': {
      background: theme.palette.primary.main,
      color: 'white',
      '&:hover': {
        background: theme.palette.primary.main,
      },
    },
    textTransform: 'none',
  },
  toggleButtonDisabled: {
    '&.Mui-selected': {
      background: theme.palette.secondary.main,
      color: theme.palette.secondary.contrastText,
      '&:hover': {
        background: theme.palette.secondary.main,
      },
    },
    textTransform: 'none',
  },
}));

const SchemasTable = ({
  activeSchemas,
  disabledSchemas,
  activeActions,
  disabledActions,
  handleActions,
}) => {
  const classes = useStyles();
  const [active, setActive] = useState(true);

  const handleChange = (event, newValue) => {
    setActive(newValue);
  };

  const visibleData = () => {
    let displayedData;
    if (active) {
      displayedData = activeSchemas.length > 0 ? activeSchemas : null;
    } else {
      displayedData = disabledSchemas.length > 0 ? disabledSchemas : null;
    }

    return displayedData
      ? displayedData.map((d) => ({
          _id: d._id,
          name: d.name,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }))
      : null;
  };

  const getActions = () => {
    if (active) {
      return activeActions;
    }
    return disabledActions;
  };

  return (
    <Container maxWidth={'lg'}>
      <Box
        width={'100%'}
        display={'inline-flex'}
        justifyContent={'center'}
        alignItems={'center'}
        margin={'10px'}>
        <ToggleButtonGroup size="large" value={active} exclusive onChange={handleChange}>
          <ToggleButton key={1} value={true} className={classes.toggleButton}>
            Active Schemas
          </ToggleButton>
          <ToggleButton key={2} value={false} className={classes.toggleButtonDisabled}>
            Disabled Schemas
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      {visibleData() && (
        <DataTable
          dsData={visibleData()}
          actions={getActions()}
          handleAction={handleActions}
        />
      )}
    </Container>
  );
};

export default SchemasTable;
