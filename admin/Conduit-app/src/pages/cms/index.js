import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import clsx from 'clsx';
import SvgIcon from '@material-ui/core/SvgIcon';
import CloseIcon from '@material-ui/icons/Close';
import Document1 from '@material-ui/icons/FilterNone';
import Document2 from '@material-ui/icons/LibraryBooks';
import TextField from '@material-ui/core/TextField';
import slugify from '../../utils/slugify';
import CustomTabs from '../../components/CustomTabs';
import Link from 'next/link';

const useStyles = makeStyles((theme) => ({
  table: {
    minWidth: 650,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    margin: 'auto',
    width: 'fit-content',
  },
  formControl: {
    marginTop: theme.spacing(2),
    minWidth: 120,
  },
  formControlLabel: {
    marginTop: theme.spacing(1),
  },
  tableRow: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.grey[100],
    },
  },
  paper: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dialogContent: {
    maxWidth: theme.spacing(75),
  },
  boxTypeContainer: {},
  boxType: {
    backgroundColor: 'white',
    height: 300,
    width: 300,
    padding: theme.spacing(5),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  selectedType: {
    backgroundColor: theme.palette.grey[100],
  },
  closeIcon: {
    position: 'absolute',
    top: theme.spacing(2),
    right: theme.spacing(2),
  },
  disableButton: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.common.white,
  },
}));

const createData = (name, id, type, itemCount, switcher) => {
  return { name, id, type, itemCount, switcher };
};

let rows = [];

let disabledRows = [];

const itemCount = 1;

export default function Types() {
  const classes = useStyles();

  const [open, setOpen] = useState(false);
  const [openDisable, setOpenDisable] = useState(false);
  const [selectedRow, setSelectedRow] = useState({});
  const [rowLength, setRowLength] = useState(rows.length);
  const [selectedType, setSelectedType] = useState('Repeatable');
  const [typeName, setTypeName] = useState('');
  const [typeId, setTypeId] = useState('');
  const [selected, setSelected] = useState(0);

  const dialogText = "You won't be able to create new instances of";
  const dialogTextArray = dialogText.split(' ');

  const tabs = [{ title: 'Active' }, { title: 'Disabled' }];

  useEffect(() => {
    const slug = slugify(typeName);
    setTypeId(slug);
  }, [typeName]);

  const handleChange = (event, newValue) => {
    setSelected(newValue);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleDisable = (row) => {
    setSelectedRow(row);
    setOpenDisable(true);
  };

  const handleCloseDisable = () => {
    setOpenDisable(false);
    setSelectedRow({});
  };

  const handleModalDisable = () => {
    rows = rows.filter(function (row) {
      return row.id !== selectedRow.id;
    });
    disabledRows.push(selectedRow);
    setOpenDisable(false);
    setSelectedRow({});
  };

  const handleRestore = (row) => {
    if (row.id) {
      rows.push(row);
      disabledRows = disabledRows.filter((r) => {
        return r.id !== row.id;
      });
    }
  };

  const handleDelete = (row) => {
    if (row.id) {
      disabledRows = disabledRows.filter((r) => {
        return r.id !== row.id;
      });
    }
  };

  const handleAdd = () => {
    setOpen(true);
    setTypeName('');
    setTypeId('');
    setSelectedType('Repeatable');
  };

  const handleTypeName = (event) => {
    setTypeName(event.target.value);
  };

  const handleAddType = () => {
    if (typeName !== '' && typeId !== '') {
      rows.push(createData(typeName, typeId, selectedType, itemCount, 5));
      setRowLength(rowLength + 1);
    }
    handleClose();
  };

  return (
    <Layout itemSelected={4}>
      <Box p={2}>
        <Box display={'flex'} justifyContent={'space-between'} alignItems={'center'} mb={2}>
          <Typography variant={'h5'}>Custom Types</Typography>
          <Button variant="contained" color="primary" style={{ textTransform: 'capitalize' }} onClick={() => handleAdd()}>
            Create new
          </Button>
        </Box>
        <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange} />
        <TableContainer component={Paper} role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
          <Table className={classes.table}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="left">API ID</TableCell>
                <TableCell align="center">Type</TableCell>
                <TableCell align="center">Ιtems count</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows &&
                rows.map((row) => (
                  <TableRow key={row.id} className={classes.tableRow}>
                    <TableCell component="th" scope="row">
                      {row.name}
                    </TableCell>
                    <TableCell align="left">{row.id}</TableCell>
                    <TableCell align="center">{row.type}</TableCell>
                    <TableCell align="center">{row.itemCount}</TableCell>
                    <TableCell align="right">
                      <Button
                        variant="contained"
                        disableElevation
                        style={{ textTransform: 'capitalize' }}
                        onClick={() => handleDisable(row)}>
                        Disable
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TableContainer component={Paper} role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>
          <Table className={classes.table}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="left">API ID</TableCell>
                <TableCell align="center">Type</TableCell>
                <TableCell align="center">Ιtems count</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {disabledRows &&
                disabledRows.map((row) => (
                  <TableRow key={row.id} className={classes.tableRow}>
                    <TableCell component="th" scope="row">
                      {row.name}
                    </TableCell>
                    <TableCell align="left">{row.id}</TableCell>
                    <TableCell align="center">{row.type}</TableCell>
                    <TableCell align="center">{row.itemCount}</TableCell>
                    <TableCell align="right">
                      <Button
                        variant="contained"
                        disableElevation
                        style={{ textTransform: 'capitalize', marginRight: 16 }}
                        onClick={() => handleRestore(row)}>
                        Restore
                      </Button>
                      <Button
                        variant="contained"
                        disableElevation
                        className={classes.disableButton}
                        style={{ textTransform: 'capitalize' }}
                        onClick={() => handleDelete(row)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      <Dialog fullWidth={true} maxWidth={'lg'} open={open} onClose={handleClose} classes={{ paper: classes.paper }}>
        <Box maxWidth={600}>
          <DialogTitle id="new-custom-type" style={{ textAlign: 'center', marginBottom: 16 }}>
            Create new custom type
          </DialogTitle>
          <DialogContent style={{ marginBottom: 16 }}>
            <Box display={'flex'} style={{ position: 'relative', marginBottom: 16 }}>
              <Box
                className={selectedType === 'Repeatable' ? clsx(classes.boxType, classes.selectedType) : classes.boxType}
                onClick={() => setSelectedType('Repeatable')}>
                <SvgIcon component={Document1} />
                <Typography variant={'body1'}>Repeatable Type</Typography>
                <Typography variant={'body2'} style={{ textAlign: 'center' }}>
                  Best for multiple instances like blog posts, authors, products...
                </Typography>
              </Box>
              <Box
                className={selectedType === 'Singleton' ? clsx(classes.boxType, classes.selectedType) : classes.boxType}
                onClick={() => setSelectedType('Singleton')}>
                <SvgIcon component={Document2} />
                <Typography variant={'body1'}>Singleton Type</Typography>
                <Typography variant={'body2'} style={{ textAlign: 'center' }}>
                  Best for a unique page, like the homepage or privacy policy page...
                </Typography>
              </Box>
            </Box>
            <TextField
              style={{ width: '100%', marginBottom: 16 }}
              id="type-name"
              label="Enter your type name"
              variant="standard"
              value={typeName}
              onChange={handleTypeName}
            />
            <DialogContent style={{ textAlign: 'center', fontSize: 12 }}>
              {typeId
                ? `API ID: ${typeId}`
                : selectedType === 'Singleton'
                ? 'e.g., Homepage, Team page...'
                : 'e.g., Blog post, Product...'}
            </DialogContent>
          </DialogContent>
          <DialogActions style={{ justifyContent: 'center' }}>
            <Link href="/cms/build-types">
              <a style={{ textDecoration: 'none' }}>
                <Button
                  onClick={handleAddType}
                  color="primary"
                  variant="contained"
                  style={{ textTransform: 'none' }}
                  disabled={typeName === '' && typeId === ''}>
                  Create new custom type
                </Button>
              </a>
            </Link>
          </DialogActions>
        </Box>
        <Button onClick={handleClose} className={classes.closeIcon}>
          <CloseIcon />
        </Button>
      </Dialog>
      <Dialog fullWidth={true} maxWidth={'md'} open={openDisable} onClose={handleCloseDisable}>
        <DialogTitle id="new-custom-type" style={{ marginBottom: 16 }}>
          Disable your custom type?
        </DialogTitle>
        <DialogContent>
          {selectedRow &&
            dialogTextArray.map((word, index) => {
              if (dialogTextArray.length - 1 === index) {
                return (
                  <span style={{ fontWeight: 'bold' }} key={index}>
                    {' '}
                    {selectedRow.name}.
                  </span>
                );
              } else {
                return <span key={index}> {word}</span>;
              }
            })}
        </DialogContent>
        <DialogContent>This operation won't delete existing documents.</DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDisable(false)} variant="contained" style={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={() => handleModalDisable()}
            className={classes.disableButton}
            variant="contained"
            style={{ textTransform: 'none' }}>
            Disable
          </Button>
        </DialogActions>
        <Button onClick={handleCloseDisable} className={classes.closeIcon}>
          <CloseIcon />
        </Button>
      </Dialog>
    </Layout>
  );
}
