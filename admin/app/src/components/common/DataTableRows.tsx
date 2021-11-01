import React, { useState } from 'react';
import {
  Box,
  Checkbox,
  Chip,
  Collapse,
  IconButton,
  makeStyles,
  TableCell,
  TableRow,
  Typography,
} from '@material-ui/core';
import DataTableActions from './DataTableActions';
import { KeyboardArrowDown, KeyboardArrowUp } from '@material-ui/icons';
import moment from 'moment';
import { Transaction } from '../../models/payments/PaymentsModels';
import DataTable from './DataTable';

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

  const formatInnerTable = (data: Transaction[]) => {
    return data.map((u) => {
      return {
        _id: u._id,
        provider: u.provider,
        product: u.product,
        quantity: u.quantity,
        'Updated At': u.updatedAt,
      };
    });
  };

  const headers = [
    { title: '_id', sort: '_id' },
    { title: 'Provider', sort: 'provider' },
    { title: 'Product', sort: 'product' },
    { title: 'Quantity', sort: 'quantity' },
    { title: 'Updated At', sort: 'updatedAt' },
  ];

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
      {collapsible && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box className={classes.pill}>
                {Object.entries(collapsible).map(([key, value], index: number) =>
                  Array.isArray(value) ? (
                    <Box
                      key={index}
                      width="83vw"
                      display="flex"
                      flexDirection="column"
                      justifyContent="center"
                      alignContent="center">
                      <Typography>Transactions: </Typography>
                      <DataTable inner dsData={formatInnerTable(value)} headers={headers} />
                    </Box>
                  ) : (
                    <Box key={index} className={classes.pill}>
                      <Chip
                        size="small"
                        color={`primary`}
                        label={`${key}: ${value}`}
                        key={`row ${key}`}
                      />
                    </Box>
                  )
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default DataTableRows;
