import React, {useState} from "react";
import {CustomAppBar} from './Header'
import makeStyles from "@material-ui/styles/makeStyles";
import CustomDrawer from './Drawer'
import CssBaseline from "@material-ui/core/CssBaseline";
import {useRouter} from "next/router";

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    padding: 0,
    minHeight: '100vh',
  },
  toolbar: theme.mixins.toolbar,
}));


export function Layout(props) {
  const classes = useStyles();
  const {menuDisabled, itemSelected, ...rest} = props;
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleDrawerOpen() {
    setOpen(true);
  }

  function handleDrawerClose() {
    setOpen(false);
  }

  function menuClick() {
    open ? handleDrawerClose() : handleDrawerOpen()
  }

  function logoClick() {
    router.push('/')
  }

  const drawerDisabled = (() => {
      if (menuDisabled === null || menuDisabled === undefined) {
        return false;
      }
      return menuDisabled;
    }
  );

  let appBar, drawer;
  if (!drawerDisabled()) {
    appBar = <CustomAppBar className={classes.appBar} onMenuClick={() => menuClick()} onLogoClick={() => logoClick()}/>;
    drawer = <CustomDrawer itemSelected={itemSelected} open={open}/>;
  } else {
    appBar = <CustomAppBar className={classes.appBar} showMenuButton={false} onMenuClick={() => menuClick()}/>;
  }

  return (
    <div className={classes.root} {...rest}>
      <CssBaseline/>
      {appBar}
      {drawer}
      <main className={classes.content}>
        <div className={classes.toolbar}/>
        {rest.children}
      </main>
    </div>
  );
}

