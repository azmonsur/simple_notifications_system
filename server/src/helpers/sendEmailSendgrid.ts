// helpers/sendEmailSendGrid.ts
import sgMail from "@sendgrid/mail";
import { logger } from "../utils/logger/logger";

interface SendEmailOptions {
  subject: string;
  htmlBody?: string;
  body: string;
  to: string;
  attachments?: {
    filename: string;
    content: Buffer | string; // usually base64 string or Buffer
    type?: string; // optional MIME type
  }[];
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
  attachments,
}: SendEmailOptions): Promise<EmailResponse> => {
  const { SENDGRID_API_TOKEN, SENDGRID_API_FROM, SENDGRID_API_NAME } =
    process.env;

  if (!SENDGRID_API_TOKEN || !SENDGRID_API_FROM) {
    const msg = "SendGrid environment variables not set";
    logger.error(`❌ ${msg}`);
    return { success: false, message: msg };
  }

  sgMail.setApiKey(SENDGRID_API_TOKEN);

  // Convert Buffers to Base64 (SendGrid requires base64 for attachments)
  const processedAttachments = attachments?.map((file) => ({
    filename: file.filename,
    type: file.type || "application/octet-stream",
    content:
      file.content instanceof Buffer
        ? file.content.toString("base64")
        : Buffer.from(file.content).toString("base64"),
    disposition: "attachment",
  }));

  const msgPayload = {
    to,
    from: {
      email: SENDGRID_API_FROM,
      name: SENDGRID_API_NAME || "System Notification",
    },
    subject,
    text: body,
    html: htmlBody || body,
    attachments: processedAttachments,
  };

  try {
    const [response] = await sgMail.send(msgPayload);
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
