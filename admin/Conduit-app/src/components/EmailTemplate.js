import Container from "@material-ui/core/Container";
import React, {useState} from "react";
import Tabs from "@material-ui/core/Tabs";
import {makeStyles} from "@material-ui/core/styles";
import Tab from "@material-ui/core/Tab";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import Divider from "@material-ui/core/Divider";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import EditIcon from '@material-ui/icons/Edit';
import TextField from "@material-ui/core/TextField";
import {verifyEmailTemplate, passwordResetTemplate, emailAddressChange} from '../assets/defaultEmailTemplate';

const useStyles = makeStyles((theme) => ({
	root: {
		flexGrow: 1,
		backgroundColor: theme.palette.background.paper,
		display: 'flex',
	},
	tabs: {
		borderRight: `1px solid ${theme.palette.divider}`,
		minWidth: '300px'
	},
	divider: {
		marginTop: theme.spacing(2),
		marginBottom: theme.spacing(2)
	},
	grid: {
		marginBottom: theme.spacing(3)
	},
	multiline: {
		width: '100%'
	},
	textField: {
		width: '95%',
	}
}));

const TabPanel = (props) => {
	const classes = useStyles();
	const {children, description, template, value, index, ...other} = props;
	
	if (value !== index) {
		return null;
	}
	
	return (
		<Container>
			<Box>
				<Typography variant="h6">{children}</Typography>
				<Typography variant="body2">
					{description}
				</Typography>
				<Divider className={classes.divider}/>
				<TemplateDetails template={template}/>
			</Box>
		</Container>
	)
};

const TemplateDetails = (props) => {
	const classes = useStyles();
	const {template} = props;
	
	const [edit, setEdit] = useState(false);
	
	const handleEditClick = () => {
		setEdit(!edit)
	};
	
	return (
		<Box>
			<Grid container className={classes.grid}>
				<Grid item xs={5}>
					<Typography variant="body1">Sender name</Typography>
					{
						edit ?
							<TextField variant="filled" className={classes.textField}/>
							:
							<Typography variant="subtitle1">not provided</Typography>
						
					}
				</Grid>
				<Grid item xs={5}>
					<Typography variant="body1">From</Typography>
					{
						edit ?
							<TextField variant="filled" className={classes.textField}/>
							:
							<Typography variant="subtitle1">noreply@butler-8bef9.firebaseapp.com</Typography>
						
					}
				</Grid>
				<Grid container justify="flex-end" item xs={2}>
					<IconButton aria-label="delete" onClick={handleEditClick}>
						<EditIcon/>
					</IconButton>
				</Grid>
			</Grid>
			{/*<Typography variant="subtitle1">Message</Typography>*/}
			<TextField
				className={classes.multiline}
				id="filled-textarea"
				label="Message"
				multiline
				variant="filled"
				defaultValue={template}
				InputProps={{
					readOnly: !edit,
				}}
			/>
		</Box>
	)
	
};

const EmailTemplate = () => {
	const classes = useStyles();
	const [value, setValue] = useState(0);
	
	const data = [
		{
			title: 'Email address verification',
			description: 'When a user signs up using an email address and password, you can send them a confirmation email to verify their registered email address.',
			template: verifyEmailTemplate
		},
		{
			title: 'Password reset',
			description: 'When a user forgets their password, a password reset email is sent to help them set up a new one.',
			template: passwordResetTemplate
		},
		{
			title: 'Email address change',
			description: 'For security, when a user changes their email address, an email is sent to their original address so they can review the change.',
			template: emailAddressChange
		}
	];
	
	const handleChange = (event, newValue) => {
		setValue(newValue);
	};
	
	return (
		<Container>
			<Box className={classes.root}>
				<Tabs
					orientation="vertical"
					variant="scrollable"
					value={value}
					onChange={handleChange}
					aria-label="Vertical tabs"
					className={classes.tabs}
				>
					<Tab label="Email address verification"/>
					<Tab label="Password reset"/>
					<Tab label="Email address change"/>
				</Tabs>
				{
					data.map((d, index) => {
						return (
							<TabPanel
								key={index}
								value={value}
								index={index}
								description={d.description}
								template={d.template}>
								{d.title}
							</TabPanel>
						)
					})
				}
			</Box>
		</Container>
	)
};

export default EmailTemplate;
