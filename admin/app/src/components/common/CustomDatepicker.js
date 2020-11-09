import MomentUtils from '@date-io/moment';
import { makeStyles } from '@material-ui/core/styles';
import { Today } from '@material-ui/icons';
import { DatePicker, MuiPickersUtilsProvider } from '@material-ui/pickers';
import React from 'react';

const useStyles = makeStyles((theme) => ({
  dateInput: {
    borderRadius: 4,
    height: 32,
    padding: theme.spacing(0, 1),
    backgroundColor: theme.palette.selectGrey,
    fontSize: 14,
    color: theme.palette.darkMain,
    fontWeight: 500,
    '& .MuiInputBase-input': {
      cursor: 'pointer',
    },
  },
  iconButton: {
    padding: 0,
    color: theme.palette.darkMain,
    marginRight: 8,
    cursor: 'pointer',
  },
  datepicker: {
    margin: theme.spacing(0, 1),
  },
}));

const CustomDatepicker = ({ value, setValue, placeholder, ...rest }) => {
  const classes = useStyles();

  const handleDateChange = (date) => {
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
