import React, { useState } from 'react';
import { Checkbox, IconButton, makeStyles, TableCell, TableRow } from '@material-ui/core';
import DataTableActions from './DataTableActions';
import { KeyboardArrowDown, KeyboardArrowUp } from '@material-ui/icons';
import moment from 'moment';
import InnerTable from './InnerTable';

const useStyles = makeStyles((theme) => ({
  ellipsisStyle: {
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    width: '350px',
    maxWidth: '350px',
  },
  pill: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    '& > *': {
      margin: theme.spacing(0.5),
    },
  },
}));

type Action = {
  title: string;
  type: string;
};

interface Props {
  collapsibleData?: any;
  row: any;
  index: number;
  actions?: Action[];
  handleAction?: (action: Action, data: any) => void;
  selectedItems: string[];
  handleSelect?: (id: string) => void;
  handleSelectAll?: (data: any) => void;
}

const DataTableRows: React.FC<Props> = ({
  collapsibleData: collapsible,
  row,
  index,
  handleAction,
  handleSelect,
  selectedItems,
  actions,
}) => {
  const classes = useStyles();
  const [open, setOpen] = useState(false);

  const getValue = (value: any) => {
    if (!isNaN(Date.parse(value)) && moment(value).isValid()) {
      return moment(value).format('DD/MM/YYYY');
    }
    return value?.toString();
  };

  const onMenuItemClick = (action: { title: string; type: string }, data: any) => {
    if (handleAction) {
      handleAction(action, data);
    }
  };

  const onMenuItemSelect = (id: string) => {
    if (handleSelect) {
      handleSelect(id);
    }
  };

  return (
    <>
      <TableRow key={index}>
        <TableCell align="left" padding="none">
          {!collapsible ? (
            <Checkbox
              color="primary"
              checked={selectedItems?.includes(row._id)}
              onChange={() => onMenuItemSelect(row._id)}
            />
          ) : (
            <IconButton aria-label="expand row" size="small" onClick={() => setOpen(!open)}>
              {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
          )}
        </TableCell>
        {Object.keys(row).map((item, j) => (
          <TableCell className={classes.ellipsisStyle} key={`row ${j}`}>
            {getValue(row[item])}
          </TableCell>
        ))}
        <TableCell key={`action-${row}`} align={'right'}>
          <DataTableActions
            actions={actions}
            onActionClick={(action) => onMenuItemClick(action, row)}
            isBlocked={!row.Active}
            editDisabled={selectedItems.length > 1}
          />
        </TableCell>
      </TableRow>
      {collapsible && <InnerTable open={open} collapsibleData={collapsible} />}
    </>
  );
};

export default DataTableRows;
