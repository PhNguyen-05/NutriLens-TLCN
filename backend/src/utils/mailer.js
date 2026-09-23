const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // true nếu dùng port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Gửi email chứa mã OTP.
 * @param {string} to - email người nhận
 * @param {string} otp - mã 6 số
 * @param {'register'|'reset'} purpose
 */
async function sendOtpEmail(to, otp, purpose) {
  const subject =
    purpose === 'register'
      ? 'Xác thực đăng ký tài khoản'
      : 'Xác thực đặt lại mật khẩu';

  await getTransporter().sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    html: `
      <p>Mã xác thực (OTP) của bạn là:</p>
      <h2 style="letter-spacing:4px">${otp}</h2>
      <p>Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
    `,
  });
}

/**
 * Gửi email cảnh báo bảo mật (vd: đổi mật khẩu thành công - UC05).
 */
async function sendSecurityAlertEmail(to, message) {
  await getTransporter().sendMail({
    from: process.env.SMTP_USER,
    to,
    subject: 'Cảnh báo bảo mật tài khoản',
    html: `<p>${message}</p>`,
  });
}

module.exports = { sendOtpEmail, sendSecurityAlertEmail };