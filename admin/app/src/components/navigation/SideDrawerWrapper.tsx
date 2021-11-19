import React, { FC } from 'react';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import { Box, DialogTitle, Drawer, IconButton } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    close: {
      zIndex: 10,
      position: 'absolute',
      right: 0,
      top: 0,
      padding: theme.spacing(0.5),
      paddingBottom: theme.spacing(0),
    },
    button: {
      padding: theme.spacing(1),
    },
    paper: {
      minWidth: (props: any) => props.minWidth,
      maxWidth: (props: any) => props.maxWidth,
      width: (props: any) => props.width,
      padding: theme.spacing(4),
    },
    header: {
      textAlign: 'center',
    },
  })
);

interface PropsDrawer {
  open: boolean;
  width?: string | number;
  title?: string;
  maxWidth?: string | number;
  minWidth?: string | number;
  closeDrawer: (close: boolean) => void;
}
const DrawerWrapper: FC<PropsDrawer> = ({
  width = 'auto',
  minWidth = 400,
  maxWidth = 1400,
  open,
  closeDrawer,
  title,
  children,
}) => {
  const classes = useStyles({ minWidth: minWidth, maxWidth: maxWidth, width: width });

  const toggleDrawer = (close: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' ||
        (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }
    closeDrawer(close);
  };

  return (
    <Drawer
      open={open}
      anchor={'right'}
      onClose={toggleDrawer(false)}
      classes={{
        paper: classes.paper,
      }}
      transitionDuration={{ appear: 300, enter: 300, exit: 200 }}>
      <Box className={classes.close}>
        <IconButton onClick={toggleDrawer(false)} className={classes.button}>
          <CloseIcon />
        </IconButton>
      </Box>
      {title && <DialogTitle className={classes.header}> {title} </DialogTitle>}
      {children}
    </Drawer>
  );
};

export default DrawerWrapper;
