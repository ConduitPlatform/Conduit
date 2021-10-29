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
import { AuthUserUI } from '../../models/authentication/AuthModels';
import { SchemaUI } from '../cms/CmsModels';
import { NotificationData } from '../../models/notifications/NotificationModels';
import Checkbox from '@material-ui/core/Checkbox';
import IndeterminateCheckBoxIcon from '@material-ui/icons/IndeterminateCheckBox';

import DataTableRows from './DataTableRows';

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
  collapsible?: any;
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
  collapsible,
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
            <DataTableRows
              collapsible={collapsible}
              row={row}
              index={i}
              handleAction={handleAction}
              handleSelect={handleSelect}
              selectedItems={selectedItems}
              key={i}
              actions={actions}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default DataTable;
