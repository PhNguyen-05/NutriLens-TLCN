const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
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
      ? 'NutriLens - Xác thực đăng ký tài khoản'
      : 'NutriLens - Xác thực đặt lại mật khẩu';

  try {
    const fromAddress = `"NutriLens" <${process.env.SMTP_USER}>`;
    const info = await getTransporter().sendMail({
      from: fromAddress,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2e7d32; margin-top: 0;">NutriLens</h2>
          <p style="font-size: 15px; color: #333;">Mã xác thực (OTP) của bạn là:</p>
          <div style="background-color: #f1f8e9; padding: 12px 24px; border-radius: 6px; display: inline-block; margin: 12px 0;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1b5e20;">${otp}</span>
          </div>
          <p style="font-size: 13px; color: #666; margin-top: 16px; margin-bottom: 0;">Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        </div>
      `,
    });
    console.log(`[mailer] Đã gửi OTP [${otp}] đến ${to} (MessageID: ${info.messageId})`);
  } catch (err) {
    console.error(`[mailer] Gửi email thất bại đến ${to}:`, err.message);
    throw err;
  }
}

/**
 * Gửi email cảnh báo bảo mật (vd: đổi mật khẩu thành công - UC05).
 */
async function sendSecurityAlertEmail(to, message) {
  try {
    const fromAddress = `"NutriLens" <${process.env.SMTP_USER}>`;
    await getTransporter().sendMail({
      from: fromAddress,
      to,
      subject: 'NutriLens - Cảnh báo bảo mật tài khoản',
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><p>${message}</p></div>`,
    });
    console.log(`[mailer] Đã gửi cảnh báo bảo mật đến ${to}`);
  } catch (err) {
    console.error(`[mailer] Gửi cảnh báo bảo mật thất bại đến ${to}:`, err.message);
    throw err;
  }
}

module.exports = { sendOtpEmail, sendSecurityAlertEmail };