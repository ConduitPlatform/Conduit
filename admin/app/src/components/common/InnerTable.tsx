import React, { FC } from 'react';
import { Box, Chip, Collapse, makeStyles, TableCell, TableRow } from '@material-ui/core';

const useStyles = makeStyles((theme) => ({
  pill: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    '& > *': {
      margin: theme.spacing(0.5),
    },
  },
}));

interface Props {
  collapsibleData?: any;
  open: boolean;
}

const InnerTable: FC<Props> = ({ collapsibleData, open }) => {
  const classes = useStyles();

  return (
    <TableRow>
      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box className={classes.pill}>
            {Object.entries(collapsibleData).map(([key, value], innerIndex: number) =>
              Array.isArray(value) ? (
                <Box
                  key={innerIndex}
                  width="83vw"
                  display="flex"
                  flexDirection="column"
                  justifyContent="center"
                  alignContent="center"></Box>
              ) : (
                <Box key={innerIndex} className={classes.pill}>
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
  );
};

export default InnerTable;
