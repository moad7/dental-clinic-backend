export const SESSION_ACTIVE_STATUSES = ['pending', 'confirmed'];
const getSessionTimestamp = (date, time) => {
  if (!date || !time) {
    return null;
  }
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }
  const [hours, minutes] = String(time).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return Date.UTC(
    parsedDate.getUTCFullYear(),
    parsedDate.getUTCMonth(),
    parsedDate.getUTCDate(),
    hours,
    minutes,
    0,
    0,
  );
};
export const getNextMissingSessionNumber = (sessions, totalSessions) => {
  const existingNumbers = new Set(
    sessions.map((session) => Number(session.sessionNumber)),
  );
  for (
    let sessionNumber = 1;
    sessionNumber <= totalSessions;
    sessionNumber += 1
  ) {
    if (!existingNumbers.has(sessionNumber)) {
      return sessionNumber;
    }
  }
  return null;
};
export const validateSessionOrder = ({
  sessionNumber,
  date,
  time,
  sessions,
}) => {
  const currentTimestamp = getSessionTimestamp(date, time);
  if (currentTimestamp === null) {
    const error = new Error('Invalid session date or time');
    error.statusCode = 400;
    throw error;
  }
  const previousSession = sessions.find(
    (session) => Number(session.sessionNumber) === Number(sessionNumber) - 1,
  );
  const nextSession = sessions.find(
    (session) => Number(session.sessionNumber) === Number(sessionNumber) + 1,
  );
  if (previousSession) {
    const previousTimestamp = getSessionTimestamp(
      previousSession.date,
      previousSession.time,
    );
    if (previousTimestamp !== null && currentTimestamp <= previousTimestamp) {
      const error = new Error(
        'Session must be scheduled after the previous session',
      );
      error.statusCode = 400;
      throw error;
    }
  }
  if (nextSession) {
    const nextTimestamp = getSessionTimestamp(
      nextSession.date,
      nextSession.time,
    );
    if (nextTimestamp !== null && currentTimestamp >= nextTimestamp) {
      const error = new Error(
        'Session must be scheduled before the next session',
      );
      error.statusCode = 400;
      throw error;
    }
  }
  return true;
};
