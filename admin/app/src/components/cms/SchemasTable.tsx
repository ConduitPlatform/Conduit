import React, { FC, useState } from 'react';
import DataTable from '../common/DataTable';
import Container from '@material-ui/core/Container';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import ToggleButton from '@material-ui/lab/ToggleButton';
import { makeStyles } from '@material-ui/core/styles';
import { SchemaUI } from './CmsModels';
import { Box, Button, Grid } from '@material-ui/core';

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
  toggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(1),
  },
  create: {
    display: 'flex',
    alignContent: 'end',
    justifyContent: 'flex-end',
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
  const [selectedSchemas, setSelectedSchemas] = useState<any>([]);
  const [active, setActive] = useState(true);
  const [sort, setSort] = useState<{ asc: boolean; index: string | null }>({
    asc: false,
    index: null,
  });

  const handleChange = (event: any, newValue: any) => {
    setActive(newValue);
  };

  const getActions = () => {
    if (active) {
      return activeActions;
    }
    return disabledActions;
  };

  const visibleData = () => {
    let displayedData;
    if (active) {
      displayedData = activeSchemas.length > 0 ? (activeSchemas as SchemaUI[]) : null;
    } else {
      displayedData = disabledSchemas.length > 0 ? (disabledSchemas as SchemaUI[]) : null;
    }
    return displayedData.map((d) => ({
      _id: d._id,
      name: d.name,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  };

  const handleSelect = (id: string) => {
    const foundTemplate = visibleData()?.find((item) => item._id === id);
    const newSelectedElements = [...selectedSchemas];
    const templateChecked = selectedSchemas.find(
      (template) => template?._id === foundTemplate?._id
    );
    if (templateChecked) {
      const index = newSelectedElements.findIndex((newId) => newId === foundTemplate?._id);
      newSelectedElements.splice(index, 2);
    } else {
      newSelectedElements.push(foundTemplate);
    }
    setSelectedSchemas(newSelectedElements);
  };

  const handleSelectAll = (elements: any) => {
    if (selectedSchemas.length === elements.length) {
      setSelectedSchemas([]);
      return;
    }

    visibleData() !== null && setSelectedSchemas(visibleData());
  };

  const headers = [
    { title: '_id', sort: '_id' },
    { title: 'Name', sort: 'name' },
    { title: 'Created at', sort: 'createdAt' },
    { title: 'Updated at', sort: 'updatedAt' },
  ];

  return (
    <Container maxWidth={'lg'}>
      <Grid container>
        <Grid item xs={4}></Grid>
        <Grid item xs={4}>
          <Box className={classes.toggle}>
            <ToggleButtonGroup value={active} exclusive onChange={handleChange}>
              <ToggleButton key={1} value={true} className={classes.toggleButton}>
                Active Schemas
              </ToggleButton>
              <ToggleButton key={2} value={false} className={classes.toggleButtonDisabled}>
                Archived Schemas
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box className={classes.create}>
            <Button
              variant="contained"
              color="primary"
              style={{ textTransform: 'capitalize' }}
              onClick={handleAdd}>
              Create new
            </Button>
          </Box>
        </Grid>
      </Grid>
      {visibleData() && (
        <DataTable
          headers={headers}
          sort={sort}
          setSort={setSort}
          dsData={visibleData()}
          actions={getActions()}
          selectedItems={selectedSchemas}
          handleSelect={handleSelect}
          handleSelectAll={handleSelectAll}
          handleAction={handleActions}
        />
      )}
    </Container>
  );
};

export default SchemasTable;
