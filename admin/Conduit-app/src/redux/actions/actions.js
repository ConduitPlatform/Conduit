import {
	ADD_AUTH_USERS,
	START_AUTH_USERS_LOADING,
	STOP_AUTH_USERS_LOADING,
	SET_AUTH_USERS_ERROR
} from './actionTypes'

export const addAuthUsers = users => ({
	type: ADD_AUTH_USERS,
	payload: users
});


export const startAuthUsersLoading = () => ({
	type: START_AUTH_USERS_LOADING
});

export const stopAuthUsersLoading = () => ({
	type: STOP_AUTH_USERS_LOADING
});


export const setAuthUsersError = error => ({
	type: SET_AUTH_USERS_ERROR,
	payload: {error}
});
