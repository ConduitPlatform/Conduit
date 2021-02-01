
export function calculateRenewDate(recurring: 'day' | 'week' | 'month' | 'year', recurringCount: number): Date {
  let renewDate = new Date();
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
  renewDate.setDate(renewDate.getDate() + days);

  return renewDate;
}

export function dateToUnixTimestamp(date: Date): number {
  return parseInt((date.getTime() / 1000).toFixed(0));
}
