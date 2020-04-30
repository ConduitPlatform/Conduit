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
import * as moment from 'moment';
import { IconButton } from '@material-ui/core';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import MenuItem from '@material-ui/core/MenuItem';
import Menu from '@material-ui/core/Menu';

const useStyles = makeStyles({
  table: {
    minWidth: 650,
  },
});

export default function DataTable({ dsData, actions, handleAction, ...rest }) {
  const classes = useStyles();

  const [order, setOrder] = useState('asc');
  const [orderById, setOrderById] = useState();
  const [anchorEl, setAnchorEl] = useState(null);

  /** menu items Action button */
  const ITEM_HEIGHT = 48;
  const open = Boolean(anchorEl);

  useEffect(() => {
    if (dsData) {
      const initOrder = Object.keys(...dsData)[0];
      setOrderById(initOrder);
    }
  }, [dsData]);

  /** table header and rows */
  const rows = dsData;
  const headerCells = Object.keys(...dsData).map((header, index) => {
    return {
      id: header,
      numeric: isNumber(rows[index]),
      disablePadding: false,
      label: header,
    };
  });

  const createSortHandler = (property) => (event) => {
    handleRequestSort(event, property);
  };

  const handleRequestSort = (event, property) => {
    const isAsc = orderById === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderById(property);
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const getValue = (value) => {
    if (!isNaN(Date.parse(value))) {
      return moment(value).format('DD/MM/YYYY');
    }
    return value.toString();
  };

  const onMenuItemClick = (action, data) => {
    handleAction(action, data);
    setAnchorEl(null);
  };

  return (
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
                  <IconButton aria-label="more" aria-controls="long-menu" aria-haspopup="true" onClick={handleClick}>
                    <MoreVertIcon />
                  </IconButton>
                  <Menu
                    id="long-menu"
                    anchorEl={anchorEl}
                    keepMounted
                    open={open}
                    onClose={handleClose}
                    PaperProps={{
                      style: {
                        maxHeight: ITEM_HEIGHT * 4.5,
                        width: '20ch',
                      },
                    }}>
                    {actions.map((action) => (
                      <MenuItem key={action.type} onClick={() => onMenuItemClick(action, row)}>
                        {action.title}
                      </MenuItem>
                    ))}
                  </Menu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
