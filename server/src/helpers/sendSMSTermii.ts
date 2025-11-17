import axios from "axios";
import convertToInternational from "./convertToInternational";
import { logger } from "../utils/logger";

interface TermiiResponse {
  success: boolean; // ✅ added for clarity
  message_id?: string;
  status?: string;
  code?: string;
  message?: string;
  statusCode?: number; // ✅ HTTP status for errors
  error?: any; // ✅ error data from API
  data?: any; // ✅ full response data
}

interface SendSMSOptions {
  body: string;
  to: string;
}

const SendSMSTermii = async ({
  body,
  to,
}: SendSMSOptions): Promise<TermiiResponse> => {
  const { TERMII_FROM, TERMII_API_TOKEN, TERMII_ENDPOINT } = process.env;

  // ⚙️ Check environment setup
  if (!TERMII_FROM || !TERMII_API_TOKEN || !TERMII_ENDPOINT) {
    const msg = "Termii environment variables not set";
    logger.error(`❌ ${msg}`);
    return { success: false, message: msg };
  }

  // ⚙️ Validate inputs
  if (!to || !body) {
    const msg = "SMS recipient and body are required";
    logger.error(`❌ ${msg}`);
    return { success: false, message: msg };
  }

  // ✅ Convert number to international format
  let phone: string;
  try {
    phone = convertToInternational(to);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(`❌ Invalid phone number "${to}": ${errMsg}`);
    return { success: false, message: `Invalid phone number: ${errMsg}` };
  }

  const payload = {
    to: phone,
    from: TERMII_FROM,
    sms: body,
    type: "plain",
    api_key: TERMII_API_TOKEN,
    channel: "whats",
  };

  try {
    // ✅ Call Termii API
    const response = await axios.post(TERMII_ENDPOINT, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });

    const data = response.data;

    console.log(response.data);

    const isSuccess =
      (data?.status && data.status.toLowerCase() === "success") ||
      (data?.code && data.code.toLowerCase() === "ok");

    if (isSuccess) {
      logger.info(`✅ SMS sent successfully to ${phone}`, data);
      return { success: true, data, message: "SMS sent successfully" };
    } else {
      logger.warn(`⚠️ Termii API returned non-success response`, data);
      return {
        success: false,
        message: data?.message || "Non-success response from Termii",
        data,
        statusCode: response.status,
      };
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;

      logger.error("❌ Termii API request failed", { status, data });

      return {
        success: false,
        message: data?.message || error.message || "API request failed",
        statusCode: status,
        error: data,
      };
    }

    logger.error("❌ Unexpected error in SendSMSTermii", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unexpected error occurred",
    };
  }
};

export default SendSMSTermii;
