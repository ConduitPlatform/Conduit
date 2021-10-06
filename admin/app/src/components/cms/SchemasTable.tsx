import React, { FC, useState } from 'react';
import DataTable from '../common/DataTable';
import Container from '@material-ui/core/Container';
import Box from '@material-ui/core/Box';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import ToggleButton from '@material-ui/lab/ToggleButton';
import { makeStyles } from '@material-ui/core/styles';
import { SchemaUI } from './CmsModels';
import { Button } from '@material-ui/core';

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

interface Props {
  activeSchemas: SchemaUI[];
  disabledSchemas: SchemaUI[];
  activeActions: any;
  disabledActions: any;
  handleActions: any;
  handleAdd: any;
}

const SchemasTable: FC<Props> = ({
  activeSchemas,
  disabledSchemas,
  activeActions,
  disabledActions,
  handleActions,
  handleAdd,
}) => {
  const classes = useStyles();
  const [active, setActive] = useState(true);

  const handleChange = (event: any, newValue: any) => {
    setActive(newValue);
  };

  const visibleData = () => {
    let displayedData;
    if (active) {
      displayedData = activeSchemas.length > 0 ? (activeSchemas as SchemaUI[]) : null;
    } else {
      displayedData = disabledSchemas.length > 0 ? (disabledSchemas as SchemaUI[]) : null;
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
      <div style={{ textTransform: 'capitalize', display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          style={{ textTransform: 'capitalize', display: 'flex', alignSelf: 'flex-end' }}
          onClick={handleAdd}>
          Create new
        </Button>
      </div>
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
        <DataTable dsData={visibleData()} actions={getActions()} handleAction={handleActions} />
      )}
    </Container>
  );
};

export default SchemasTable;
