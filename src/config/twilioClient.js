import twilio from 'twilio';

const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;

if (!accountSid || !authToken) {
  throw new Error('Twilio credentials are missing in .env');
}

const twilioClient = twilio(accountSid, authToken);

export default twilioClient;
