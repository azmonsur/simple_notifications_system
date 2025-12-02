const wa_dlr = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "4304270773175861",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "2348107963504",
              phone_number_id: "826781770524694",
            },
            statuses: [
              {
                id: "wamid.HBgNMjM0ODEzMjMyOTE4NxUCABEYEjY0NzZBNEM4NjgxNDg3MzM1MgA=",
                status: "failed",
                timestamp: "1764693261",
                recipient_id: "2348132329187",
                errors: [
                  {
                    code: 131047,
                    title: "Re-engagement message",
                    message: "Re-engagement message",
                    error_data: {
                      details:
                        "Message failed to send because more than 24 hours have passed since the customer last replied to this number.",
                    },
                    href: "https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/",
                  },
                ],
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
};

const message_id =
  wa_dlr.entry[0].changes[0].value.statuses[0].id.split(".")[1];
const message_status = wa_dlr.entry[0].changes[0].value.statuses[0].status;
const timestamp = wa_dlr.entry[0].changes[0].value.statuses[0].timestamp;
const recipient_id = wa_dlr.entry[0].changes[0].value.statuses[0].recipient_id;
const error_info =
  wa_dlr.entry[0].changes[0].value.statuses[0].errors[0].error_data.details;
const external_id = wa_dlr.entry[0].id;
const message_from =
  wa_dlr.entry[0].changes[0].value.metadata.display_phone_number;
