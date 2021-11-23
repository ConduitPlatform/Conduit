import React, { FC, useEffect, useState } from 'react';
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
  const [selectedSchemas, setSelectedSchemas] = useState<SchemaUI[]>([]);
  const [dataToDisplay, setDataToDisplay] = useState<SchemaUI[]>([]);
  const [active, setActive] = useState(true);
  const [sort, setSort] = useState<{ asc: boolean; index: string | null }>({
    asc: false,
    index: null,
  });

  useEffect(() => {
    let displayedData;
    if (active && activeSchemas.length > 0) {
      displayedData = activeSchemas as SchemaUI[];
    } else if (disabledSchemas.length > 0) {
      displayedData = disabledSchemas as SchemaUI[];
    }
    if (displayedData !== undefined) {
      displayedData = displayedData.map((d) => ({
        _id: d._id,
        name: d.name,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));
      setDataToDisplay(displayedData);
    }
  }, [activeSchemas, disabledSchemas, active]);

  const handleChange = (event: any, newValue: any) => {
    setActive(newValue);
  };

  const getActions = () => {
    if (active) {
      return activeActions;
    }
    return disabledActions;
  };

  const handleSelect = (id: string) => {
    const foundTemplate = dataToDisplay?.find((item) => item._id === id);
    const newSelectedElements = [...selectedSchemas];
    const schemaChecked = selectedSchemas.find((schema) => schema?._id === foundTemplate?._id);

    if (schemaChecked) {
      const index = newSelectedElements.findIndex((element) => element._id === foundTemplate?._id);
      newSelectedElements.splice(index, 1);
    } else {
      foundTemplate !== undefined && newSelectedElements.push(foundTemplate);
    }
    setSelectedSchemas(newSelectedElements);
  };

  const handleSelectAll = (elements: any) => {
    if (selectedSchemas.length === elements.length) {
      setSelectedSchemas([]);
      return;
    }
    if (dataToDisplay !== null && dataToDisplay !== undefined) setSelectedSchemas(dataToDisplay);
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
      {dataToDisplay.length > 0 && (
        <DataTable
          headers={headers}
          sort={sort}
          setSort={setSort}
          dsData={dataToDisplay}
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
