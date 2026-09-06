export const WEEK_DAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export const CONFLICT_STATUSES = ['pending', 'confirmed'];

export const getWeekdayName = (dateString) => {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return WEEK_DAYS[date.getDay()];
};

export const generateTimeSlots = (start, end, stepMinutes = 30) => {
  const slots = [];

  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);

  let current = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  while (current < endTotal) {
    const hour = Math.floor(current / 60);
    const minute = current % 60;

    slots.push(
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    );

    current += stepMinutes;
  }

  return slots;
};
