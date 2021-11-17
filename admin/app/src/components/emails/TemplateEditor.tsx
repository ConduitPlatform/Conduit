import Editor from 'react-simple-code-editor';
import React, { FC } from 'react';
import { makeStyles } from '@material-ui/core';
import { highlight, languages } from 'prismjs';

import 'prismjs/components/prism-handlebars';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-clike';
import 'prismjs/themes/prism-dark.css';

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
  disabled?: boolean;
}

const TemplateEditor: FC<Props> = ({ value, setValue, disabled }) => {
  const classes = useStyles();
  const onValueChange = (editorValue: string) => {
    if (setValue) {
      setValue(editorValue);
    }
  };

  return (
    <Editor
      className={classes.editor}
      disabled={disabled}
      value={value}
      onValueChange={(editorValue) => onValueChange(editorValue)}
      highlight={(editorValue) => highlight(editorValue, languages['handlebars'], 'handlebars')}
      padding={10}
    />
  );
};

export default TemplateEditor;
