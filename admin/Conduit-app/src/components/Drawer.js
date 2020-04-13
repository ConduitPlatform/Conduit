import React from "react";
import {Drawer} from "@material-ui/core";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListItem from "@material-ui/core/ListItem";
import List from "@material-ui/core/List";
import Divider from "@material-ui/core/Divider";
import makeStyles from "@material-ui/styles/makeStyles";
import {Home, People, Email, Cloud} from '@material-ui/icons'
import clsx from "clsx";
import Link from "next/link";

const drawerWidth = 200;
const drawerWidthClosed = 52;

const useStyles = makeStyles(theme => ({
	drawerOpen: {
		width: drawerWidth,
		transition: theme.transitions.create('width', {
			easing: theme.transitions.easing.sharp,
			duration: theme.transitions.duration.enteringScreen,
		}),
	},
	drawerClose: {
		transition: theme.transitions.create('width', {
			easing: theme.transitions.easing.sharp,
			duration: theme.transitions.duration.leavingScreen,
		}),
		overflowX: 'hidden',
		width: drawerWidthClosed,
	},
	toolbar: theme.mixins.toolbar,
	listItem: {
		color: theme.palette.primary.main,
		borderWidth: '1px',
		borderStyle: 'solid',
		borderColor: theme.palette.primary.main,
		paddingLeft: 4,
		paddingRight: 4,
		'&:hover': {
			borderWidth: '1px',
			borderStyle: 'solid',
			borderColor: theme.palette.primary.main,
		},
		'&:focus': {
			borderWidth: '1px',
			borderStyle: 'solid',
			borderColor: theme.palette.primary.main,
		},
		'&.Mui-selected': {
			color: theme.palette.common.white,
			background: theme.palette.primary.main,
			borderWidth: '1px',
			borderStyle: 'solid',
			borderColor: theme.palette.primary.main,
			'&:hover': {
				background: theme.palette.primary.dark,
				borderWidth: '1px',
				borderStyle: 'solid',
				borderColor: theme.palette.primary.dark,
			},
			'&:focus': {
				background: theme.palette.primary.dark,
				borderWidth: '1px',
				borderStyle: 'solid',
				borderColor: theme.palette.primary.dark,
			},
		},
	},
	listItemText: {
		fontWeight: 'bold',
	},
	listItemIcon: {
		minWidth: 36,
		marginRight: theme.spacing(1),
		color: 'inherit'
	}
}));

function CustomDrawer(props) {
	const classes = useStyles();
	
	const {open, itemSelected, ...rest} = props;
	
	const drawerOpen = (() => {
			if (open === null || open === undefined) {
				return false;
			}
			return open;
		}
	);
	
	const divStyle = {
		padding: '8px',
	};
	
	const itemStyle = {
		height: '34px',
		borderRadius: '4px',
		marginBottom: '12px',
	};
	
	return (
		<Drawer
			variant="permanent"
			className={clsx(classes.drawer, {
				[classes.drawerOpen]: drawerOpen(),
				[classes.drawerClose]: !drawerOpen(),
			})}
			classes={{
				paper: clsx({
					[classes.drawerOpen]: drawerOpen(),
					[classes.drawerClose]: !drawerOpen(),
				}),
			}}
			open={drawerOpen()}
			{...rest}
		>
			<div className={classes.toolbar}/>
			
			<div className={classes.toolbar}/>
			
			<div style={divStyle}>
				<Divider/>
				
				<List component="nav">
					<Link href='/'>
						<ListItem button key={"Home"} className={classes.listItem} style={itemStyle}
						          selected={itemSelected === 0}>
							<ListItemIcon className={classes.listItemIcon}>
								<Home color={'inherit'}/>
							</ListItemIcon>
							<ListItemText primary={"Home"} classes={{primary: classes.listItemText}}/>
						</ListItem>
					</Link>
					<Link href='/authentication'>
						<ListItem button key={"Authentication"} className={classes.listItem} style={itemStyle}
						          selected={itemSelected === 1}>
							<ListItemIcon className={classes.listItemIcon}>
								<People color={'inherit'}/>
							</ListItemIcon>
							<ListItemText primary={"Authentication"} classes={{primary: classes.listItemText}}/>
						</ListItem>
					</Link>
					<Link href='/emails'>
						<ListItem button key={"Emails"} className={classes.listItem} style={itemStyle}
						          selected={itemSelected === 2}>
							<ListItemIcon className={classes.listItemIcon}>
								<Email color={'inherit'}/>
							</ListItemIcon>
							<ListItemText primary={"Emails"} classes={{primary: classes.listItemText}}/>
						</ListItem>
					</Link>
					<Link href='/storage'>
						<ListItem button key={"Storage"} className={classes.listItem} style={itemStyle}
						          selected={itemSelected === 4}>
							<ListItemIcon className={classes.listItemIcon}>
								<Cloud color={'inherit'}/>
							</ListItemIcon>
							<ListItemText primary={"Storage"} classes={{primary: classes.listItemText}}/>
						</ListItem>
					</Link>
				</List>
				<Divider/>
			</div>
		</Drawer>
	);
}

export default CustomDrawer;
