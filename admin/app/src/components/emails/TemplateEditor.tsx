import Editor from 'react-simple-code-editor';
import React, { FC } from 'react';
import { makeStyles } from '@material-ui/core';
import { highlight, languages } from 'prismjs';

import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-markup';
// import 'prismjs/themes/prism.css';
// import 'prismjs/themes/prism-coy.css';
import 'prismjs/themes/prism-dark.css';
// import 'prismjs/themes/prism-funky.css';
// import 'prismjs/themes/prism-okaidia.css';
// import 'prismjs/themes/prism-solarizedlight.css';
// import 'prismjs/themes/prism-tomorrow.css';

const useStyles = makeStyles(() => ({
  editor: {
    minHeight: 300,
    width: '100%',
    backgroundColor: 'rgb(40 40 40)',
  },
}));

interface Props {
  value: string;
  setValue: (value: string) => void;
}

const TemplateEditor: FC<Props> = ({ value, setValue }) => {
  const classes = useStyles();
  const onValueChange = (value: string) => {
    if (setValue) {
      setValue(value);
    }
  };

  console.log('value', value);

  return (
    <Editor
      className={classes.editor}
      value={value}
      onValueChange={(value) => onValueChange(value)}
      highlight={(jsSample) => highlight(jsSample, languages['markup'], 'markup')}
      padding={10}
    />
  );
};

export default TemplateEditor;
