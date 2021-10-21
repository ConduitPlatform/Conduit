import React, { FC, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

const Dropzone: FC = () => {
  const onDrop = useCallback((acceptedFiles) => {
    console.log('acceptedFiles', acceptedFiles);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });
  const { ...rootProps } = getRootProps();
  const { ...inputProps } = getInputProps();

  return (
    <div {...rootProps}>
      <input {...inputProps} />
      {isDragActive ? (
        <p>Drop the files here ...</p>
      ) : (
        <p>Drag n drop some files here, or click to select files</p>
      )}
    </div>
  );
};

export default Dropzone;
