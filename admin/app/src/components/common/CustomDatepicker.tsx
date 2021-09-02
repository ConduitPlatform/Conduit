import MomentUtils from '@date-io/moment';
import { makeStyles } from '@material-ui/core/styles';
import { Today } from '@material-ui/icons';
import { DatePicker, MuiPickersUtilsProvider } from '@material-ui/pickers';
import React from 'react';
import { MaterialUiPickersDate } from '@material-ui/pickers/typings/date';
import { ParsableDate } from '@material-ui/pickers/constants/prop-types';

const useStyles = makeStyles((theme) => ({
  dateInput: {
    borderRadius: 4,
    height: 32,
    padding: theme.spacing(0, 1),
    backgroundColor: '#C8C6C6',
    fontSize: 14,
    color: '#2C2E43',
    fontWeight: 500,
    '& .MuiInputBase-input': {
      cursor: 'pointer',
    },
  },
  iconButton: {
    padding: 0,
    color: '#2C2E43',
    marginRight: 8,
    cursor: 'pointer',
  },
  datepicker: {
    margin: theme.spacing(0, 1),
  },
}));

interface Props {
  value: ParsableDate;
  setValue: (date: MaterialUiPickersDate) => void;
  placeholder: string;
}

const CustomDatepicker: React.FC<Props> = ({ value, setValue, placeholder, ...rest }) => {
  const classes = useStyles();

  const handleDateChange = (date: MaterialUiPickersDate) => {
    setValue(date);
  };

  return (
    <MuiPickersUtilsProvider utils={MomentUtils}>
      <DatePicker
        {...rest}
        className={classes.datepicker}
        autoOk
        disableToolbar
        variant="inline"
        format="DD/MM/YYYY"
        value={value}
        onChange={handleDateChange}
        placeholder={placeholder}
        invalidDateMessage={''}
        emptyLabel={' -- / -- / ---- '}
        InputProps={{
          disableUnderline: true,
          className: classes.dateInput,
          startAdornment: <Today className={classes.iconButton} />,
        }}
      />
    </MuiPickersUtilsProvider>
  );
};

export default CustomDatepicker;
