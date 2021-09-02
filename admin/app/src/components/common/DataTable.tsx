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
import { IconButton } from '@material-ui/core';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import MenuItem from '@material-ui/core/MenuItem';
import Menu from '@material-ui/core/Menu';
import { AuthUserUI } from '../authentication/AuthModels';
import { SchemaUI } from '../cms/CmsModels';

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
  dsData: SchemaUI[] | AuthUserUI[]; //todo add notification types
  actions: Action[];
  handleAction: (action: Action, data: any) => void;
}

const DataTable: React.FC<Props> = ({ dsData, actions, handleAction, ...rest }) => {
  const classes = useStyles();

  const [order, setOrder] = useState<'desc' | 'asc'>('asc');
  const [orderById, setOrderById] = useState<string>('_id');
  const [anchorEl, setAnchorEl] = useState<HTMLElement>();
  const [selectedRow, setSelectedRow] = useState(null);

  /** menu items Action button */
  const ITEM_HEIGHT = 48;
  const open = Boolean(anchorEl);

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

  const handleClick = (
    event: React.MouseEvent<HTMLAnchorElement> | React.MouseEvent<HTMLButtonElement>,
    row: any
  ) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const getValue = (value: any) => {
    if (!isNaN(Date.parse(value)) && moment(value).isValid()) {
      return moment(value).format('DD/MM/YYYY');
    }
    return value?.toString();
  };

  const onMenuItemClick = (action: { title: string; type: string }, data: any) => {
    handleAction(action, data);
    setAnchorEl(undefined);
  };

  return (
    <>
      <TableContainer component={Paper} {...rest}>
        <Table className={classes.table} aria-label="simple table">
          <TableHead>
            <TableRow>
              {/*	todo add checkbox cells in the future*/}
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
                {Object.keys(row).map((item, j) => (
                  <TableCell key={`${i}-${j}`}>{getValue(row[item])}</TableCell>
                ))}
                {actions && (
                  <TableCell key={`action-${i}`} align={'right'}>
                    <IconButton
                      aria-label="more"
                      aria-controls="long-menu"
                      aria-haspopup="true"
                      onClick={(event) => handleClick(event, row)}>
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {actions && (
        <Menu
          id="long-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          PaperProps={{
            style: {
              maxHeight: ITEM_HEIGHT * 4.5,
              width: '20ch',
            },
          }}>
          {actions.map((action, i) => (
            <MenuItem
              key={`${action.type}-${i}`}
              onClick={() => onMenuItemClick(action, selectedRow)}>
              {action.title}
            </MenuItem>
          ))}
        </Menu>
      )}
    </>
  );
};

export default DataTable;
