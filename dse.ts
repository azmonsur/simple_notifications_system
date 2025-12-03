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
