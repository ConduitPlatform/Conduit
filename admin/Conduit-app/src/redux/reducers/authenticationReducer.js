import {setCookie, removeCookie} from '../../utils/cookie';

import {
	CLEAR_AUTHENTICATION_TOKEN,
	SET_AUTHENTICATION_TOKEN,
	SET_AUTHENTICATION_TOKEN_ERROR,
	START_AUTHENTICATION_LOADING,
	STOP_AUTHENTICATION_LOADING
} from "../actions/actionTypes";

const initialState = {
	token: null,
	loading: false,
	error: null
};

const authenticationReducer = (state = initialState, action) => {
	switch (action.type) {
		case SET_AUTHENTICATION_TOKEN:
			setCookie('JWT', action.payload);
			return {
				...state,
				token: action.payload
			};
		case SET_AUTHENTICATION_TOKEN_ERROR:
			return {
				...state,
				error: action.payload.error
			};
		case START_AUTHENTICATION_LOADING:
			return {
				...state,
				loading: true
			};
		case STOP_AUTHENTICATION_LOADING:
			return {
				...state,
				loading: false
			};
		case CLEAR_AUTHENTICATION_TOKEN:
			removeCookie('JWT');
			return {
				...state,
				token: null
			};
		default:
			return state;
	}
};

export default authenticationReducer;
