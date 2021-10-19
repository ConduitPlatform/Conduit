import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import TableSortLabel from '@material-ui/core/TableSortLabel';
import { isNumber } from 'lodash';
import moment from 'moment';
import { AuthUserUI } from '../../models/authentication/AuthModels';
import { SchemaUI } from '../cms/CmsModels';
import { NotificationData } from '../../models/notifications/NotificationModels';
import DataTableActions from './DataTableActions';
import Checkbox from '@material-ui/core/Checkbox';
import IndeterminateCheckBoxIcon from '@material-ui/icons/IndeterminateCheckBox';

const useStyles = makeStyles((theme) => ({
  table: {
    minWidth: 650,
  },
  header: {
    backgroundColor: theme.palette.background.paper,
  },
  tableContainer: {
    maxHeight: '70vh',
  },
  ellipsisStyle: {
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    width: '350px',
    maxWidth: '350px',
  },
}));

type Action = {
  title: string;
  type: string;
};

interface Props {
  dsData: SchemaUI[] | AuthUserUI[] | NotificationData[] | any;
  actions?: Action[];
  handleAction?: (action: Action, data: any) => void;
  selectedItems?: string[];
  handleSelect?: (id: string) => void;
  handleSelectAll?: (data: any) => void;
}

const DataTable: React.FC<Props> = ({
  dsData,
  actions,
  handleAction,
  selectedItems = [],
  handleSelect,
  handleSelectAll,
  ...rest
}) => {
  const classes = useStyles();

  /** table header and rows */
  const rows = dsData;
  const headerCells = Object.keys(dsData[0]).map((header, index) => {
    return {
      id: header,
      numeric: isNumber(rows[index]),
      disablePadding: false,
      label: header,
    };
  });

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

  const onMenuItemSelectAll = () => {
    if (handleSelectAll) {
      handleSelectAll(dsData);
    }
  };

  return (
    <TableContainer className={classes.tableContainer} component={Paper} {...rest}>
      <Table stickyHeader className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell className={classes.header} align="left" padding="none">
              <Checkbox
                color="primary"
                onChange={onMenuItemSelectAll}
                checked={selectedItems?.length === dsData.length}
                indeterminate={selectedItems?.length > 0 && selectedItems?.length < dsData.length}
                indeterminateIcon={<IndeterminateCheckBoxIcon color="primary" />}
              />
            </TableCell>
            {headerCells.map((headCell) => (
              <TableCell
                className={classes.header}
                key={headCell.id}
                align={headCell.numeric ? 'right' : 'left'}
                padding={headCell.disablePadding ? 'none' : 'default'}>
                <TableSortLabel active={false} direction={'asc'}>
                  {headCell.label}
                </TableSortLabel>
              </TableCell>
            ))}
            {actions && <TableCell className={classes.header} />}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row: any, i: number) => (
            <TableRow key={i}>
              <TableCell align="left" padding="none">
                <Checkbox
                  color="primary"
                  checked={selectedItems?.includes(row._id)}
                  onChange={() => onMenuItemSelect(row._id)}
                />
              </TableCell>
              {Object.keys(row).map((item, j) => (
                <TableCell className={classes.ellipsisStyle} key={`${i}-${j}`}>
                  {getValue(row[item])}
                </TableCell>
              ))}
              <TableCell key={`action-${i}`} align={'right'}>
                <DataTableActions
                  actions={actions}
                  onActionClick={(action) => onMenuItemClick(action, row)}
                  isBlocked={!row.Active}
                  editDisabled={selectedItems?.length > 1}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default DataTable;
