import {createStore, applyMiddleware} from 'redux';
import rootReducer from './reducers';
import thunk from 'redux-thunk';

let store;

export const initStore = (initialState = {}) => {
	store = createStore(rootReducer, initialState, applyMiddleware(thunk));
	return store;
};

const getStore = () => {
	return store;
};

export default getStore;
