const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const ALERT_FROM = process.env.ALERT_FROM || 'alerts@example.com';
const ALERT_TO = process.env.ALERT_TO || process.env.SMTP_USER || '';

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
} else {
  transporter = null;
}

async function sendAlertEmail(tenant, alert) {
  if (!transporter) {
    console.warn('SMTP not configured; skipping email alert');
    return null;
  }
  const subject = `[ALERTA] tenant=${tenant} ${alert.type}`;
  const text = `Alerta detectado:\n\n${JSON.stringify(alert, null, 2)}`;
  try {
    const info = await transporter.sendMail({ from: ALERT_FROM, to: ALERT_TO, subject, text });
    return info;
  } catch (e) {
    console.error('Failed to send alert email', e);
    return null;
  }
}

module.exports = { sendAlertEmail };
