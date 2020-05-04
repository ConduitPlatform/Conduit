import React from 'react';
import Box from '@material-ui/core/Box';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import { makeStyles } from '@material-ui/core/styles';
import Divider from '@material-ui/core/Divider';

const useStyles = makeStyles((theme) => ({
  tab: {
    textTransform: 'capitalize',
  },
  divider: {
    marginBottom: theme.spacing(2),
  },
}));

export default function CustomTabs({ tabs, selected, handleChange, ...rest }) {
  const classes = useStyles();

  return (
    <Box {...rest}>
      <Tabs indicatorColor={'primary'} textColor={'primary'} value={selected} onChange={handleChange}>
        {tabs &&
          tabs.map((tab, index) => (
            <Tab key={`tab-${index}`} label={tab.title} className={classes.tab} disabled={tab.isDisabled} href={tab.href}/>
          ))}
      </Tabs>
      <Divider className={classes.divider} />
    </Box>
  );
}
