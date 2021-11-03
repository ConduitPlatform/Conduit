import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper, { PaperProps } from '@material-ui/core/Paper';
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
  innerTableContainer: {
    maxHeight: '70vh',
    backgroundColor: theme.palette.background.default,
  },
  ellipsisStyle: {
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    width: '350px',
    maxWidth: '350px',
  },
  placeholder: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(4),
  },
}));

type Action = {
  title: string;
  type: string;
};

interface Props extends PaperProps {
  collapsible?: any;
  inner?: boolean;
  headers: any;
  sort?: { asc: boolean; index: string | null };
  setSort?: React.Dispatch<
    React.SetStateAction<{
      asc: boolean;
      index: string | null;
    }>
  >;
  dsData: SchemaUI[] | AuthUserUI[] | NotificationData[] | any;
  selectable?: boolean;
  actions?: Action[];
  handleAction?: (action: Action, data: any) => void;
  selectedItems?: string[];
  handleSelect?: (id: string) => void;
  handleSelectAll?: (data: any) => void;
  handleRowClick?: (data: any) => void;
}

const DataTable: React.FC<Props> = ({
  collapsible,
  inner,
  headers,
  sort,
  setSort,
  dsData = [],
  actions,
  handleAction,
  selectable = true,
  selectedItems = [],
  handleSelect,
  handleSelectAll,
  handleRowClick,
  ...rest
}) => {
  const classes = useStyles();

  const onSelectedField = (index: string) => {
    if (setSort !== undefined)
      setSort((prevState: { asc: boolean; index: string | null }) => {
        if (prevState.index === index) {
          return { asc: !prevState.asc, index: index };
        }
        return { asc: prevState.asc, index: index };
      });
  };

  const getHeaderValues = (value: string) => {
    if (value === 'icon') {
      return '';
    }
    return value;
  };

  const onMenuItemSelectAll = () => {
    if (handleSelectAll) {
      handleSelectAll(dsData);
    }
  };

  const onRowClick = (item: any) => {
    if (handleRowClick) {
      handleRowClick(item);
    }
  };

  const handleSortDirection = (asc: boolean) => {
    if (asc) {
      return 'asc';
    }
    return 'desc';
  };

  return (
    <TableContainer
      className={!inner ? classes.tableContainer : classes.innerTableContainer}
      component={Paper}
      {...rest}>
      <Table stickyHeader className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell className={classes.header} align="left" padding="none">
              {!collapsible && actions && selectable && (
                <Checkbox
                  color="primary"
                  onChange={onMenuItemSelectAll}
                  checked={selectedItems?.length === dsData.length}
                  indeterminate={selectedItems?.length > 0 && selectedItems?.length < dsData.length}
                  indeterminateIcon={<IndeterminateCheckBoxIcon color="primary" />}
                />
              )}
            </TableCell>
            {headers.map((header: any, idx: number) => (
              <TableCell className={classes.header} key={idx}>
                {header.sort ? (
                  <TableSortLabel
                    active={sort?.index === header.sort}
                    direction={handleSortDirection(header.sort?.asc)}
                    onClick={() => onSelectedField(header.sort)}>
                    {getHeaderValues(header.title)}
                  </TableSortLabel>
                ) : (
                  <>{getHeaderValues(header.title)}</>
                )}
              </TableCell>
            ))}
            {actions && <TableCell className={classes.header} />}
          </TableRow>
        </TableHead>
        <TableBody>
          {dsData.map((row: any, i: number) => (
            <DataTableRows
              collapsible={collapsible !== undefined ? collapsible[i] : null}
              row={row}
              index={i}
              handleAction={handleAction}
              handleSelect={handleSelect}
              selectedItems={selectedItems}
              key={i}
              actions={actions}
              onRowClick={onRowClick}
              selectable={selectable}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default DataTable;
