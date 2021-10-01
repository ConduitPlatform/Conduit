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
import { isNumber, orderBy } from 'lodash';
import moment from 'moment';
import { AuthUserUI } from '../../models/authentication/AuthModels';
import { SchemaUI } from '../cms/CmsModels';
import { NotificationData } from '../../models/notifications/NotificationModels';
import DataTableActions from './DataTableActions';
import Checkbox from '@material-ui/core/Checkbox';

const useStyles = makeStyles({
  table: {
    minWidth: 650,
  },
});

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

  const [order, setOrder] = useState<'desc' | 'asc'>('asc');
  const [orderById, setOrderById] = useState<string>('_id');

  useEffect(() => {
    if (dsData) {
      const initOrder = Object.keys(dsData[0])[0];
      setOrderById(initOrder);
    }
  }, [dsData]);

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

  const createSortHandler = (property: string) => (event: any) => {
    handleRequestSort(event, property);
  };

  const handleRequestSort = (event: MouseEvent, property: string) => {
    const isAsc = orderById === property && order === 'desc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderById(property);
  };

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
    <TableContainer component={Paper} {...rest}>
      <Table className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell align="left" padding="none">
              <Checkbox
                color="primary"
                onChange={onMenuItemSelectAll}
                checked={selectedItems?.length > 0}
              />
            </TableCell>
            {headerCells.map((headCell) => (
              <TableCell
                key={headCell.id}
                align={headCell.numeric ? 'right' : 'left'}
                padding={headCell.disablePadding ? 'none' : 'default'}
                sortDirection={orderById === headCell.id ? order : false}>
                <TableSortLabel
                  active={orderById === headCell.id}
                  direction={orderById === headCell.id ? order : 'asc'}
                  onClick={createSortHandler(headCell.id)}>
                  {headCell.label}
                </TableSortLabel>
              </TableCell>
            ))}
            {actions && <TableCell />}
          </TableRow>
        </TableHead>
        <TableBody>
          {orderBy(rows, orderById, order).map((row, i) => (
            <TableRow key={i}>
              <TableCell align="left" padding="none">
                <Checkbox
                  color="primary"
                  checked={selectedItems?.includes(row._id)}
                  onChange={() => onMenuItemSelect(row._id)}
                />
              </TableCell>
              {Object.keys(row).map((item, j) => (
                <TableCell key={`${i}-${j}`}>{getValue(row[item])}</TableCell>
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
