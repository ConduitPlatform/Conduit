import React, { useEffect, useState } from 'react';
import { Box, Button, Typography, Tabs, Tab, createStyles, makeStyles } from '@material-ui/core';
import { useRouter } from 'next/router';
import Link from 'next/link';

const useStyles = makeStyles((theme) =>
  createStyles({
    root: {
      height: '100vh',
      padding: theme.spacing(4),
    },
    navBar: {
      marginBottom: theme.spacing(2),
    },
    swaggerButton: {
      textDecoration: 'none',
      marginLeft: theme.spacing(8),
    },
    navContent: {
      marginTop: '10px',
    },
    link: {
      textDecoration: 'none',
      color: 'inherit',
    },
    tab: {
      '&:hover': {
        textDecoration: 'none',
      },
    },
    tabSelected: {
      opacity: 1,
      '&:hover': {
        textDecoration: 'none',
      },
    },
  })
);

interface Props {
  pathNames: string[];
  swagger: string;
  icon: JSX.Element;
  labels: { name: string; id: string }[];
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

  return (
    <Box className={classes.root}>
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
        <Tabs value={value} className={classes.navContent}>
          {labels.map((label: { name: string; id: string }, index: number) => {
            return (
              <Link href={pathNames[index]} passHref key={index}>
                <Tab
                  label={label.name}
                  id={label.id}
                  classes={{
                    root: value === index ? classes.tabSelected : classes.tab,
                  }}
                />
              </Link>
            );
          })}
        </Tabs>
      </Box>
      <Box>{children}</Box>
    </Box>
  );
};

export default SharedLayout;
