import React, {Component} from "react";
import Router from "next/router";

export function privateRoute(WrappedComponent) {
	return class extends Component {
		
		static async getInitialProps(ctx) {
			const token = ctx.store.getState().authenticationReducer.token;
			return {
				auth: !!token
			};
		}
		
		componentDidMount() {
			console.log(this.state);
			const {auth} = this.props;
			
			if (!auth) {
				// Router.replace('/login')
			}
		}
		
		render() {
			const {auth, ...propsWithoutAuth} = this.props;
			return <WrappedComponent auth={auth} {...propsWithoutAuth} />;
		}
	};
}
