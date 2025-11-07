import sgMail from "@sendgrid/mail";
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

const SendEmailSendGrid = async ({
  subject,
  to,
  htmlBody,
  body,
}: SendEmailOptions): Promise<EmailResponse> => {
  const { SENDGRID_API_TOKEN, SENDGRID_API_FROM, SENDGRID_API_NAME } =
    process.env;

  logger.error(SENDGRID_API_TOKEN);
  logger.error(SENDGRID_API_FROM);
  logger.error(SENDGRID_API_NAME);

  if (!SENDGRID_API_TOKEN || !SENDGRID_API_FROM) {
    const msg = "SendGrid environment variables not set";
    logger.error(`❌ ${msg}`);
    return { success: false, message: msg };
  }

  sgMail.setApiKey(SENDGRID_API_TOKEN);

  const msgPayload = {
    to,
    from: {
      email: SENDGRID_API_FROM,
      name: SENDGRID_API_NAME || "System Notification",
    },
    subject,
    text: body,
    html: htmlBody || body,
  };

  try {
    const [response] = await sgMail.send(msgPayload); // sgMail.send returns an array
    const statusCode = response?.statusCode;

    if (statusCode >= 200 && statusCode < 300) {
      logger.info(`✅ Email sent successfully to ${to}`, response);
      return {
        success: true,
        statusCode,
        message: "Email sent successfully",
        data: response,
      };
    } else {
      logger.warn(`⚠️ SendGrid returned non-success status`, response);
      return {
        success: false,
        statusCode,
        message: "Non-success response from SendGrid API",
        error: response,
      };
    }
  } catch (error: unknown) {
    logger.error("❌ SendGrid API request failed", error);
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

export default SendEmailSendGrid;
