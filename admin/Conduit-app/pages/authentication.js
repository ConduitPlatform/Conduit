import React, {useState} from 'react';
import AuthAccordion from "../components/AuthAccordion";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import {Layout} from "../components/Layout";
import CustomTabs from "../components/CustomTabs";

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

const dummyHandleData = (type, data) => {
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

const tabs = ['Users', 'Sign-In Method'];

export default function Authentication() {
  const [selected, setSelected] = useState(0);

  const handleChange = (event, newValue) => {
    setSelected(newValue);
  };

  return (
      <Layout itemSelected={1}>
        <Box p={2}>
          <Typography variant={"h4"}>Authentication</Typography>
          <CustomTabs tabs={tabs} selected={selected} handleChange={handleChange}/>
          <Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
          </Box>
          <Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>
            <AuthAccordion data={dummyData} handleData={dummyHandleData}/>
          </Box>
        </Box>
      </Layout>
  );
}
