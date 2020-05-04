import Box from '@material-ui/core/Box';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Container from '@material-ui/core/Container';
import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Card from '@material-ui/core/Card';
import TreeView from '@material-ui/lab/TreeView';
import TreeItem from '@material-ui/lab/TreeItem';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import CardHeader from '@material-ui/core/CardHeader';
import IconButton from '@material-ui/core/IconButton';
import { MoreVert } from '@material-ui/icons';
import CardContent from '@material-ui/core/CardContent';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';

const useStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
  },
  tabs: {
    borderRight: `1px solid ${theme.palette.divider}`,
    minWidth: '300px',
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  grid: {
    marginBottom: theme.spacing(3),
  },
  multiline: {
    width: '100%',
  },
  textField: {
    width: '95%',
  },
  tree: {
    flexGrow: 1,
    maxWidth: 400,
  },
  card: {
    margin: theme.spacing(1),
  },
  cardContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    flex: 1,
  },
  bold: {
    fontWeight: 'bold',
  },
}));

const TabPanel = (props) => {
  const classes = useStyles();
  const { value, index, children, ...other } = props;

  if (value !== index) {
    return null;
  }

  return <Box className={classes.cardContainer}>{children}</Box>;
};

const renderTree = (nodes) => {
  const classes = useStyles();
  return (
    <TreeItem
      key={nodes.id}
      nodeId={nodes.id}
      label={
        <Typography>
          <span className={classes.bold}>{`${Object.keys(nodes)[1]}: `}</span>
          {`${nodes[Object.keys(nodes)[1]]}`}
        </Typography>
      }>
      {Array.isArray(nodes.children) ? nodes.children.map((node) => renderTree(node)) : null}
    </TreeItem>
  );
};

const ITEM_HEIGHT = 48;
const options = ['edit', 'delete'];

const SchemaData = ({ data, ...rest }) => {
  const classes = useStyles();
  const [value, setValue] = useState(0);

  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  return (
    <Container>
      <Box className={classes.root}>
        <Tabs
          value={value}
          onChange={handleChange}
          orientation="vertical"
          variant="scrollable"
          aria-label="Vertical tabs"
          className={classes.tabs}>
          {data.map((d, index) => {
            return <Tab key={`tabs${index}`} label={d.schemaTitle} />;
          })}
        </Tabs>

        {data.map((schemas, index) => {
          return (
            <TabPanel key={`tabPanel${index}`} value={value} index={index}>
              {schemas.schemaDocs.map((docs, index) => {
                return (
                  <Card key={`card${index}`} className={classes.card} variant={'outlined'}>
                    <CardHeader
                      title={docs.title}
                      action={
                        <>
                          <IconButton aria-label="settings" onClick={handleClick}>
                            <MoreVert />
                          </IconButton>
                          <Menu
                            id="long-menu"
                            anchorEl={anchorEl}
                            keepMounted
                            open={open}
                            onClose={handleClose}
                            PaperProps={{
                              style: {
                                maxHeight: ITEM_HEIGHT * 4.5,
                                width: '20ch',
                              },
                            }}>
                            {options.map((option) => (
                              <MenuItem key={option} selected={option === 'Pyxis'} onClick={handleClose}>
                                {option}
                              </MenuItem>
                            ))}
                          </Menu>
                        </>
                      }
                    />
                    <CardContent>
                      {docs.treeData.map((tree, index) => {
                        return (
                          <TreeView
                            key={`treeView${index}`}
                            className={classes.tree}
                            defaultCollapseIcon={<ExpandMoreIcon />}
                            defaultExpanded={['root']}
                            defaultExpandIcon={<ChevronRightIcon />}>
                            {renderTree(tree)}
                          </TreeView>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </TabPanel>
          );
        })}
      </Box>
    </Container>
  );
};

export default SchemaData;
