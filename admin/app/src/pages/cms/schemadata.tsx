import React, { ReactElement, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import CmsLayout from '../../components/navigation/InnerLayouts/cmsLayout';
import { asyncGetCmsSchemas, asyncGetSchemaDocuments } from '../../redux/slices/cmsSlice';
import { Schema } from '../../models/cms/CmsModels';
import SchemaData from '../../components/cms/SchemaData';

const SchemaDataPage = () => {
  const dispatch = useAppDispatch();
  const data = useAppSelector((state) => state.cmsSlice.data);

  const handleSelectSchema = (name: string) => {
    dispatch(asyncGetSchemaDocuments(name));
  };

  useEffect(() => {
    dispatch(asyncGetCmsSchemas(50));
  }, [dispatch]);

  const getActiveSchemas = () => {
    if (!data || !data.schemas) {
      return [];
    }
    return data.schemas.filter((s: Schema) => s.enabled);
  };

  return (
    data &&
    data.schemas &&
    data.schemas.length > 0 && (
      <SchemaData schemas={getActiveSchemas()} handleSchemaChange={handleSelectSchema} />
    )
  );
};

SchemaDataPage.getLayout = function getLayout(page: ReactElement) {
  return <CmsLayout>{page}</CmsLayout>;
};

export default SchemaDataPage;
