import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import { makeStyles } from '@material-ui/core/styles';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import { AddCircleOutline } from '@material-ui/icons';
import React, { useEffect, useState } from 'react';
import TabPanel from './TabPanel';
import { EmailTemplateType } from '../../models/emails/EmailModels';

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
    marginBottom: theme.spacing(3),
  },
  textField: {
    width: '100%',
  },
  paper: {
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(2),
  },
}));

interface Props {
  templatesData: EmailTemplateType[];
  error: any;
  handleSave: (data: EmailTemplateType) => void;
  handleCreate: (data: EmailTemplateType) => void;
}

const EmailTemplate: React.FC<Props> = ({
  templatesData,
  error,
  handleSave,
  handleCreate,
}) => {
  const classes = useStyles();
  const [value, setValue] = useState<number>(0);
  const [templatesState, setTemplatesState] = useState<EmailTemplateType[]>([]);

  useEffect(() => {
    if (!templatesData) {
      return;
    }
    setTemplatesState(templatesData);
  }, [templatesData, error]);

  const handleChange = (event: React.ChangeEvent<any>, newValue: number) => {
    setValue(newValue);
  };

  const saveTemplateChanges = (data: EmailTemplateType) => {
    handleSave(data);
  };

  const createNewTemplate = (data: EmailTemplateType) => {
    handleCreate(data);
  };

  const newTemplate = () => {
    const newTemplate = {
      _id: 'newTemplate_id',
      name: 'New Template',
      subject: '',
      body: '',
      variables: [],
    };
    setTemplatesState([...templatesState, newTemplate]);
    setValue(templatesState.length);
  };

  return (
    <Container>
      <Grid container item xs={12} justify={'flex-end'}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutline />}
          onClick={() => newTemplate()}>
          New Template
        </Button>
      </Grid>
      <Paper className={classes.paper}>
        <Box className={classes.root}>
          <Tabs
            orientation="vertical"
            variant="scrollable"
            value={value}
            onChange={handleChange}
            aria-label="Vertical tabs"
            className={classes.tabs}>
            {templatesState.map((t) => (
              <Tab key={t._id} label={t.name} />
            ))}
          </Tabs>
          {templatesState.map((t, index) => (
            <TabPanel
              key={t._id}
              value={value}
              index={index}
              template={t}
              handleSave={saveTemplateChanges}
              handleCreate={createNewTemplate}>
              {t.name}
            </TabPanel>
          ))}
        </Box>
      </Paper>
    </Container>
  );
};

export default EmailTemplate;
