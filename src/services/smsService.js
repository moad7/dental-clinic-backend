import twilioClient from '../config/twilioClient.js';

const FROM = process.env.TWILIO_PHONE;

class SmsService {
  /**
   * إرسال رسالة أساسية
   */
  static async sendRaw({ to, body }) {
    if (!to || !body) {
      throw new Error('to and body are required');
    }

    try {
      const msg = await twilioClient.messages.create({
        body,
        from: FROM,
        to: '+972503886510',
      });

      return {
        success: true,
        sid: msg.sid,
      };
    } catch (error) {
      console.error('Twilio SMS Error:', error);
      throw new Error(error.message || 'Failed to send SMS');
    }
  }

  /**
   * إرسال OTP
   */
  static async sendOTP({ to, code, minutesValid }) {
    if (!code) {
      throw new Error('OTP code is required');
    }

    const body = `رمز التحقق الخاص بك هو: ${code} 🎯 صالح لمدة ${minutesValid} دقائق.`;
    return this.sendRaw({ to, body });
  }

  /**
   * إرسال تذكير موعد
   */
  static async sendAppointmentReminder({
    to,
    name,
    date,
    time,
    clinicName = 'عيادتنا',
  }) {
    const body = `مرحباً ${name} 🌿
تذكير بموعدك في ${clinicName} بتاريخ ${date} الساعة ${time}.
إذا ما تقدر تحضر، ياريت تبلغنا مسبقاً.`;

    return this.sendRaw({ to, body });
  }

  /**
   * إرسال Template عام مع متغيّرات
   */
  static async sendFromTemplate({ to, template, vars = {} }) {
    let body = template;

    for (const key in vars) {
      const value = vars[key];
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return this.sendRaw({ to, body });
  }
}

export default SmsService;
