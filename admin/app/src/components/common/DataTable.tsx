import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import TableSortLabel from '@material-ui/core/TableSortLabel';
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
  headers: any;
  sort?: { asc: boolean; index: string | null };
  setSort?: any;
  dsData: SchemaUI[] | AuthUserUI[] | NotificationData[] | any;
  actions?: Action[];
  handleAction?: (action: Action, data: any) => void;
  selectedItems?: string[];
  handleSelect?: (id: string) => void;
  handleSelectAll?: (data: any) => void;
}

const DataTable: React.FC<Props> = ({
  headers,
  sort,
  setSort,
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

  const onSelectedField = (index: string) => {
    setSort((prevState: any) => {
      if (prevState.index === index) {
        return { asc: !prevState.asc, index: index };
      }
      return { asc: prevState.asc, index: index };
    });
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
            {headers.map((header: any) => (
              <TableCell className={classes.header} key={header.sort}>
                <TableSortLabel
                  active={sort?.index === header.sort}
                  direction={sort?.asc ? 'asc' : 'desc'}
                  onClick={() => onSelectedField(header.sort)}>
                  {header.title}
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
