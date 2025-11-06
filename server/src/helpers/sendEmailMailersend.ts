import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";
import { logger } from "../utils/logger";

interface SendEmailOptions {
  subject: string;
  htmlBody?: string;
  body: string;
  to: string;
}

interface EmailResponse {
  success: boolean;
  statusCode?: number;
  message?: string;
  data?: any;
  error?: any;
}

const SendEmailMailerSend = async ({
  subject,
  to,
  htmlBody,
  body,
}: SendEmailOptions): Promise<EmailResponse> => {
  const { MAILERSEND_API_TOKEN, MAILERSEND_API_FROM, MAILERSEND_API_NAME } =
    process.env;

  if (!MAILERSEND_API_TOKEN || !MAILERSEND_API_FROM) {
    const msg = "MailerSend environment variables not set";
    logger.error(`❌ ${msg}`);
    return { success: false, message: msg };
  }

  const mailerSend = new MailerSend({ apiKey: MAILERSEND_API_TOKEN });

  const sentFrom = new Sender(
    MAILERSEND_API_FROM,
    MAILERSEND_API_NAME || "System Notification"
  );
  const recipients = [new Recipient(to, to.split("@")[0])];

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setSubject(subject)
    .setHtml(htmlBody || body)
    .setText(body);

  try {
    const response = await mailerSend.email.send(emailParams);

    // MailerSend SDK usually returns { statusCode, body }
    if (response?.statusCode >= 200 && response?.statusCode < 300) {
      logger.info(`✅ Email sent successfully to ${to}`, response);
      return {
        success: true,
        statusCode: response.statusCode,
        message: "Email sent successfully",
        data: response.body,
      };
    } else {
      logger.warn(`⚠️ MailerSend returned non-success status`, response);
      return {
        success: false,
        statusCode: response?.statusCode,
        message: "Non-success response from MailerSend API",
        error: response,
      };
    }
  } catch (error: unknown) {
    logger.error("❌ MailerSend API request failed", error);
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
        error,
      };
    } else {
      return {
        success: false,
        message: "Unexpected error while sending email",
        error,
      };
    }
  }
};

export default SendEmailMailerSend;
