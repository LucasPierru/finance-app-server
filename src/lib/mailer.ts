import nodemailer, { type Transporter } from "nodemailer";
import { serverEnv } from "../config/env.js";

let transporter: Transporter | null = null;

function smtpConfigured(): boolean {
  return Boolean(serverEnv.smtpHost && serverEnv.smtpPort && serverEnv.smtpUser && serverEnv.smtpPass && serverEnv.emailFrom);
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: serverEnv.smtpHost,
      port: serverEnv.smtpPort,
      secure: serverEnv.smtpSecure,
      auth: {
        user: serverEnv.smtpUser,
        pass: serverEnv.smtpPass,
      },
    });
  }

  return transporter;
}

export async function sendVerificationCode(email: string, code: string): Promise<void> {
  if (!smtpConfigured()) {
    console.info(`Auth code for ${email}: ${code}`);
    return;
  }

  await getTransporter().sendMail({
    from: serverEnv.emailFrom,
    to: email,
    subject: `${serverEnv.appName} sign-in code`,
    text: `Your ${serverEnv.appName} verification code is ${code}. It expires in ${serverEnv.authCodeTtlMinutes} minutes.`,
    html: `<p>Your <strong>${serverEnv.appName}</strong> verification code is:</p><p style="font-size: 24px; font-weight: 700; letter-spacing: 0.2em;">${code}</p><p>This code expires in ${serverEnv.authCodeTtlMinutes} minutes.</p>`,
  });
}
