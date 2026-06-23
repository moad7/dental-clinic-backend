export const WEEK_DAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export const isValidTime = (time) => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
};

export const getWeekdayName = (dateString) => {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return WEEK_DAYS[date.getDay()];
};

export const getDateOnlyRange = (dateString) => {
  const start = new Date(dateString);

  if (Number.isNaN(start.getTime())) {
    return null;
  }

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};
