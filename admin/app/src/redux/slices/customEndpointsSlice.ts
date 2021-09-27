import { createSlice } from '@reduxjs/toolkit';
import { EndpointInputs } from '../../models/cms/CmsModels';
import { Assignment } from '../../models/customEndpoints/customEndpointsModels';

// TODO create proper Interface for the slices' initial state

interface ICustomEndpointSlice {
  data: {
    endpoint: {
      _id: string;
      name: string;
      operation: any;
      selectedSchema: string;
      authentication: boolean;
      paginated?: boolean;
      sorted?: boolean;
      inputs: EndpointInputs[];
      queries: [];
      assignments: Assignment[];
      enabled?: boolean;
      selectedSchemaName?: string;
      returns?: string;
      createdAt?: string;
      updatedAt?: string;
    };
    schemaFields: [];
    selectedEndpoint: any;
  };
}

const initialState: ICustomEndpointSlice = {
  data: {
    endpoint: {
      _id: '',
      name: '',
      operation: -1,
      selectedSchema: '',
      authentication: false,
      paginated: false,
      sorted: false,
      inputs: [],
      queries: [],
      assignments: [],
    },
    schemaFields: [],
    selectedEndpoint: undefined,
  },
};

const customEndpointsSlice = createSlice({
  name: 'customEndpoints',
  initialState,
  reducers: {
    setSelectedEndPoint(state, action) {
      state.data.selectedEndpoint = action.payload;
    },
    setSchemaFields(state, action) {
      state.data.schemaFields = action.payload;
    },
    setEndpointData(state, action) {
      state.data.endpoint = { ...state.data.endpoint, ...action.payload };
    },
    endpointCleanSlate(state) {
      state.data = initialState.data;
    },
  },
});

export default customEndpointsSlice.reducer;
export const {
  setSelectedEndPoint,
  setSchemaFields,
  setEndpointData,
  endpointCleanSlate,
} = customEndpointsSlice.actions;
