import moment from 'moment';

export function calculateRenewDate(
  recurring: 'day' | 'week' | 'month' | 'year',
  recurringCount: number = 1
): moment.Moment {
  let renewDate = moment();
  let days;

  switch (recurring) {
    case 'day':
      days = recurringCount;
      break;
    case 'week':
      days = recurringCount * 7;
      break;
    case 'month':
      days = recurringCount * 31;
      break;
    case 'year':
      days = recurringCount * 365;
      break;
  }

  renewDate.add(days, 'days');

  return renewDate;
}

export function dateToUnixTimestamp(date: moment.Moment): number {
  return parseInt((date.valueOf() / 1000).toFixed(0));
}
