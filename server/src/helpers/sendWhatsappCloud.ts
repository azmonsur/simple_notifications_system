import fetch from "node-fetch";
import convertToInternational from "./convertToInternational";
import { logger } from "../utils/logger";

interface SendWhatsAppOptions {
  to: string;
  body?: string; // optional if using template
  templateName?: string;
  templateParams?: Record<string, string>;
}

interface WhatsAppResponse {
  success: boolean; // unified success flag
  statusCode?: number;
  message?: string;
  data?: any;
  error?: any;
}

const SendWhatsApp = async ({
  to,
  body,
  templateName,
  templateParams,
}: SendWhatsAppOptions): Promise<WhatsAppResponse> => {
  const { WHATSAPP_PHONE_ID, WHATSAPP_TOKEN } = process.env;

  if (!WHATSAPP_PHONE_ID || !WHATSAPP_TOKEN) {
    const msg = "WhatsApp Cloud environment variables not set";
    logger.error(`❌ ${msg}`);
    return { success: false, message: msg };
  }

  if (!to || (!body && !templateName)) {
    const msg =
      "Recipient 'to' and either 'body' or 'templateName' are required";
    logger.error(`❌ ${msg}`);
    return { success: false, message: msg };
  }

  let requestBody: any;

  // ✅ Convert number to international format

  try {
    to = convertToInternational(to);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(`❌ Invalid phone number "${to}": ${errMsg}`);
    return { success: false, message: `Invalid phone number: ${errMsg}` };
  }

  if (templateName) {
    requestBody = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en_US" },
        components: [
          {
            type: "body",
            parameters: Object.entries(templateParams || {}).map(
              ([, value]) => ({ type: "text", text: value })
            ),
          },
        ],
      },
    };
  } else {
    requestBody = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v24.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    // 👇 Explicitly type-cast JSON response
    const data = (await response.json()) as Record<string, any>;

    if (response.ok && !data.error) {
      logger.info(`✅ WhatsApp message sent successfully to ${to}`, data);
      return {
        success: true,
        statusCode: response.status,
        message: "WhatsApp message sent successfully",
        data,
      };
    }

    logger.warn(`⚠️ WhatsApp API returned non-success response`, data);
    return {
      success: false,
      statusCode: response.status,
      message:
        typeof data?.error?.message === "string"
          ? data.error.message
          : "Non-success response from WhatsApp API",
      error: data.error,
      data,
    };
  } catch (error: unknown) {
    logger.error("❌ WhatsApp API request failed", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unexpected error occurred",
      error,
    };
  }
};

export default SendWhatsApp;
