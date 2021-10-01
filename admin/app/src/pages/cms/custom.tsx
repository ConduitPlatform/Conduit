import React, { ReactElement, useEffect } from 'react';
import { useAppDispatch } from '../../redux/store';
import CmsLayout from '../../components/navigation/InnerLayouts/CmsLayout';
import {
  asyncCreateCustomEndpoints,
  asyncDeleteCustomEndpoints,
  asyncGetCmsSchemas,
  asyncGetCustomEndpoints,
  asyncUpdateCustomEndpoints,
} from '../../redux/slices/cmsSlice';

import CustomQueries from '../../components/cms/custom-endpoints/CustomQueries';

const Custom = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(asyncGetCmsSchemas(50));
    dispatch(asyncGetCustomEndpoints(''));
  }, [dispatch]);

  const handleCreateCustomEndpoint = (data: any) => {
    if (data) {
      dispatch(asyncCreateCustomEndpoints(data));
    }
  };

  const handleDeleteCustomEndpoint = (endpointId: string) => {
    if (endpointId) {
      dispatch(asyncDeleteCustomEndpoints(endpointId));
    }
  };

  const handleEditCustomEndpoint = (_id: string, data: any) => {
    dispatch(asyncUpdateCustomEndpoints({ _id, endpointData: data }));
  };

  return (
    <CustomQueries
      handleCreate={handleCreateCustomEndpoint}
      handleEdit={handleEditCustomEndpoint}
      handleDelete={handleDeleteCustomEndpoint}
    />
  );
};

Custom.getLayout = function getLayout(page: ReactElement) {
  return <CmsLayout>{page}</CmsLayout>;
};

export default Custom;
