import { Container } from '@material-ui/core';
import React from 'react';
import Paper from '@material-ui/core/Paper';
import Breadcrumbs from '@material-ui/core/Breadcrumbs';
import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import TableBody from '@material-ui/core/TableBody';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  textField: {
    marginBottom: theme.spacing(2),
  },
  simpleTextField: {
    width: '65ch',
  },
  typography: {
    marginBottom: theme.spacing(4),
  },
  table: {
    minWidth: 650,
  },
}));

const StorageFiles: React.FC = () => {
  const classes = useStyles();

  const handleClick = (event: any) => {
    event.preventDefault();
    console.info('You clicked a breadcrumb.');
  };

  return (
    <Container maxWidth={'md'}>
      <Paper elevation={5} className={classes.paper}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link color="inherit" href="/" onClick={handleClick}>
            quint.conduit.gr/store
          </Link>
          <Link
            color="inherit"
            href="/getting-started/installation/"
            onClick={handleClick}>
            Core
          </Link>
          <Typography color="textPrimary">Breadcrumb</Typography>
        </Breadcrumbs>

        <Table className={classes.table} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Size</TableCell>
              <TableCell align="right">Type</TableCell>
              <TableCell align="right">Last modified</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow key={121}>
              <TableCell component="th" scope="row">
                {'test'}
              </TableCell>
              <TableCell align="right">{'1.61MB'}</TableCell>
              <TableCell align="right">{'image/jpeg'}</TableCell>
              <TableCell align="right">{'Feb 9, 2019'}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>
    </Container>
  );
};

export default StorageFiles;
