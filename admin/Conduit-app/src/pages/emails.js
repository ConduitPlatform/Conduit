import {Layout} from "../components/Layout";
import React, {useState} from "react";
import Typography from "@material-ui/core/Typography";
import CustomTabs from "../components/CustomTabs";
import Box from "@material-ui/core/Box";
import SendEmailForm from "../components/SendEmailForm";
import EmailTemplate from "../components/EmailTemplate";
import {privateRoute} from "../components/utils/privateRoute";
import ProviderData from "../components/ProviderData";

const Emails = () => {
	const tabs = ['Templates', 'Send email', 'Provider details'];
	
	
	const [selected, setSelected] = useState(0);
	
	const handleChange = (event, newValue) => {
		setSelected(newValue);
	};
	
	return (
		<Layout itemSelected={2}>
			<Box p={2}>
				<Typography variant={"h4"}>Emails</Typography>
				<CustomTabs tabs={tabs} selected={selected} handleChange={handleChange}/>
				<Box role="tabpanel" hidden={selected !== 0} id={`tabpanel-0`}>
					<EmailTemplate/>
				</Box>
				<Box role="tabpanel" hidden={selected !== 1} id={`tabpanel-1`}>
					<SendEmailForm/>
				</Box>
				<Box role="tabpanel" hidden={selected !== 2} id={`tabpanel-2`}>
					<ProviderData/>
				</Box>
			</Box>
		</Layout>
	)
};

export default privateRoute(Emails);
