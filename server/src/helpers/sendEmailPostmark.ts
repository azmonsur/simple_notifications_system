import { ServerClient, Message } from "postmark";
import { logger } from "../utils/logger/logger";

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

const SendEmailPostmark = async ({
  subject,
  to,
  htmlBody,
  body,
}: SendEmailOptions): Promise<EmailResponse> => {
  const { POSTMARK_API_TOKEN, POSTMARK_API_FROM } = process.env;

  if (!POSTMARK_API_TOKEN || !POSTMARK_API_FROM) {
    const msg = "Postmark environment variables not set";
    logger.error(`❌ ${msg}`);
    return { success: false, message: msg };
  }

  const client = new ServerClient(POSTMARK_API_TOKEN);

  const message: Message = {
    From: POSTMARK_API_FROM,
    To: to,
    Subject: subject,
    HtmlBody: htmlBody,
    TextBody: body,
    MessageStream: "notifications",
  };

  try {
    const response = await client.sendEmail(message);

    // Postmark SDK usually returns: { To, SubmittedAt, MessageID, ErrorCode, Message }
    if (response.ErrorCode === 0) {
      logger.info(`✅ Email sent successfully to ${to}`, response);
      return {
        success: true,
        statusCode: 200,
        message: "Email sent successfully",
        data: response,
      };
    } else {
      logger.warn(`⚠️ Postmark API returned an error`, response);
      return {
        success: false,
        statusCode: response.ErrorCode,
        message: response.Message || "Postmark API returned an error",
        error: response,
      };
    }
  } catch (error: unknown) {
    logger.error("❌ Postmark API request failed", error);
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

export default SendEmailPostmark;
