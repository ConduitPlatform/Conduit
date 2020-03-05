import React, {useState} from 'react';
import AuthAccordion from "../components/AuthAccordion";
import Box from "@material-ui/core/Box";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Typography from "@material-ui/core/Typography";
import {makeStyles} from "@material-ui/core/styles";

let dummyData = {
  email: {
    enabled: false
  },
  phone: {
    enabled: false
  },
  google: {
    enabled: false,
    id: '',
    secret: ''
  },
  facebook: {
    enabled: false,
    id: '',
    secret: ''
  }
};

const useStyles = makeStyles(theme => ({
  tabContent: {
    marginBottom: theme.spacing(2)
  },
  tab: {
    fontSize: 16,
    textTransform: 'capitalize'
  }
}));

const handleData = (type, data) => {
  //TODO API Request
  switch (type) {
    case 'email':
      dummyData.email = data;
      break;
    case 'phone':
      dummyData.phone = data;
      break;
    case 'google':
      dummyData.google = data;
      break;
    case 'facebook':
      dummyData.facebook = data;
      break;
    default:
      return
  }
};

export default function Authentication() {

  const classes = useStyles();

  const [selected, setSelected] = useState(0);

  const handleChange = (event, newValue) => {
    setSelected(newValue);
  };

  function a11yProps(index) {
    return {
      id: `tab-${index}`,
      'aria-controls': `tabpanel-${index}`,
    };
  }

  return (
    <Box p={2}>
      <Typography variant={"h5"} className={classes.title}>Authentication</Typography>
      <Tabs value={selected} onChange={handleChange} className={classes.tabContent}>
        <Tab label="Users" className={classes.tab} {...a11yProps(0)} />
        <Tab label="Sign-in method" className={classes.tab} {...a11yProps(1)} />
      </Tabs>
      <div
        role="tabpanel"
        hidden={selected !== 0}
        id={`tabpanel-${selected}`}>
        Users
      </div>
      <Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-${selected}`}>
        <AuthAccordion data={dummyData} handleData={handleData}/>
      </Box>
    </Box>


  );
}
