import React from 'react';
import {AppBar, Box} from "@material-ui/core";
import Toolbar from "@material-ui/core/Toolbar";
import {Menu} from "@material-ui/icons";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";

const BoxStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  marginLeft: '12px',
  justifyContent: 'space-between'
};

const EmptyDivStyle = {
  marginLeft: '-12px',
  width: '48px',
  height: '48px',
  marginRight: '2px'
};

export function CustomAppBar(props) {
  const {onMenuClick, showMenuButton, onLogoClick, ...rest} = props;

  const handleMenuClick = (() => {
    if (onMenuClick === null || onMenuClick === undefined) {
      return;
    }
    onMenuClick();
  });

  const showMenuIcon = (() => {
      if (showMenuButton === null || showMenuButton === undefined) {
        return true;
      }
      return showMenuButton;
    }
  );

  let menuButton;
  if (showMenuIcon()) {
    menuButton =
      <IconButton edge="start" color="inherit" onClick={() => handleMenuClick()}>
        <Menu/>
      </IconButton>
  } else {
    menuButton = <div style={EmptyDivStyle}/>
  }
  return (
    <AppBar color="primary" position="fixed" {...rest}> {rest.children}
      <Toolbar>
        {menuButton}
        <Box style={BoxStyle}>
          <Typography variant={"h6"} style={onLogoClick ? {cursor: 'pointer'} : {}} onClick={() => onLogoClick ? onLogoClick() : null}>
            Conduit
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  );
}




