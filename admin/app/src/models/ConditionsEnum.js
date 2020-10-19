const ConditionsEnum = {
  EQUAL: 0, //'equal to'
  NEQUAL: 1, //'not equal to'
  GREATER: 2, //'greater than'
  GREATER_EQ: 3, //'greater that or equal to'
  LESS: 4, //'less than'
  LESS_EQ: 5, //'less that or equal to'
  EQUAL_SET: 6, //'equal to any of the following'
  NEQUAL_SET: 7, //'not equal to any of the following'
  CONTAIN: 8, //'an array containing'
};
export default ConditionsEnum;
