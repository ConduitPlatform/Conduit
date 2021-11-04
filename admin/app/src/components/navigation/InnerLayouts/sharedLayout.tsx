import { createStyles, makeStyles } from '@material-ui/core';
import React, { useEffect, useState } from 'react';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import { Box, Button } from '@material-ui/core';
import { useRouter } from 'next/router';

const useStyles = makeStyles((theme) =>
  createStyles({
    navBar: {
      position: 'fixed',
      top: 0,
      backgroundColor: '#262840',
      width: '100vw',
      padding: theme.spacing(0.5),
      zIndex: 10,
    },
    content: {
      marginTop: '110px',
    },
    swaggerButton: {
      textDecoration: 'none',
      marginLeft: theme.spacing(8),
    },
    navContent: {
      marginTop: '10px',
    },
  })
);

interface Props {
  children: any;
  pathNames: string[];
  swagger: string;
  icon: any;
  labels: string[];
  title: string;
}

const SharedLayout: React.FC<Props> = ({ children, pathNames, swagger, icon, labels, title }) => {
  const classes = useStyles();
  const router = useRouter();
  const [value, setValue] = useState(0);

  useEffect(() => {
    const index = pathNames.findIndex((pathname: string) => pathname === router.pathname);
    setValue(index);
  }, [router.pathname, pathNames]);

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setValue(newValue);
    router.push(`${event.currentTarget.id}`, undefined, { shallow: false });
  };

  return (
    <Box p={4}>
      <Box className={classes.navBar}>
        <Typography className={classes.navContent} variant={'h4'}>
          {title}
          <a
            href={`${process.env.CONDUIT_URL}/swagger/#/${swagger}`}
            target="_blank"
            rel="noreferrer"
            className={classes.swaggerButton}>
            <Button variant="outlined" endIcon={icon}>
              SWAGGER
            </Button>
          </a>
        </Typography>
        <Tabs value={value} className={classes.navContent} onChange={handleChange}>
          {labels.map((label, index) => (
            <Tab key={index} label={label} id={label} />
          ))}
        </Tabs>
      </Box>
      <Box className={classes.content}>{children}</Box>
    </Box>
  );
};

export default SharedLayout;
