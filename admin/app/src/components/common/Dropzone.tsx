import React, { FC, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  root: {
    cursor: 'pointer',
    borderWidth: 1,
    borderStyle: 'dotted',
    borderColor: '#fff',
  },
  dropContainer: {
    height: 240,
    padding: theme.spacing(0, 4),
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'grey',
    textAlign: 'center',
  },
}));

const Dropzone: FC = () => {
  const classes = useStyles();

  const [currentImage, setCurrentImage] = useState<string>();

  const handleSetImage = (image: File) => {
    const reader = new FileReader();
    reader.readAsDataURL(image);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64Image = reader.result.split(',')[1];
        setCurrentImage(base64Image);
      }
    };
    reader.onerror = (error) => {
      throw error;
    };
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: 'image/*',
    onDrop: (acceptedFiles) => {
      handleSetImage(acceptedFiles[0]);
    },
  });

  const { ...rootProps } = getRootProps();
  const { ...inputProps } = getInputProps();

  return (
    <Box className={classes.root} {...rootProps}>
      <input {...inputProps} />
      <Box className={classes.dropContainer}>
        {currentImage ? (
          <img src={'data:image/jpeg;base64,' + currentImage} alt={''} style={{ height: '100%' }} />
        ) : (
          <>
            {isDragActive ? (
              <Typography variant="body1">Drop the files here ...</Typography>
            ) : (
              <Typography variant="body1">
                Drag n drop some files here, or click to select files
              </Typography>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export default Dropzone;
