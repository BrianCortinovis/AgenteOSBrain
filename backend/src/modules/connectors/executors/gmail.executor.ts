import { ConnectorExecutor, ConnectorResult } from './types';
import nodemailer from 'nodemailer';

export const gmailExecutor: ConnectorExecutor = {
  id: 'gmail',

  async execute(action: string, params: Record<string, any>, config: Record<string, any>): Promise<ConnectorResult> {
    switch (action) {
      case 'send_email': {
        return await sendEmail(params, config);
      }

      case 'send_html_email': {
        return await sendEmail({ ...params, html: params.html || params.body }, config);
      }

      default:
        return { success: false, error: `Azione Gmail non supportata: ${action}` };
    }
  },
};

async function sendEmail(params: Record<string, any>, config: Record<string, any>): Promise<ConnectorResult> {
  const email = config.email || config.user;
  const password = config.app_password || config.password;

  if (!email || !password) {
    return { success: false, error: 'Email e app_password Gmail non configurati' };
  }

  if (!params.to) {
    return { success: false, error: 'Destinatario (to) non specificato' };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: email, pass: password },
    });

    const mailOptions: any = {
      from: params.from || email,
      to: params.to,
      subject: params.subject || 'Messaggio da Agent OS',
    };

    if (params.html) {
      mailOptions.html = params.html;
    } else {
      mailOptions.text = params.text || params.body || params.message || '';
    }

    if (params.cc) mailOptions.cc = params.cc;
    if (params.bcc) mailOptions.bcc = params.bcc;

    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      data: { messageId: info.messageId },
      message: `Email inviata a ${params.to}`,
    };
  } catch (err: any) {
    return { success: false, error: `Errore invio email: ${err.message}` };
  }
}
