FROM rabbitmq:3-management

# Install delayed message exchange plugin
RUN apt-get update && apt-get install -y curl && \
    curl -L -o /plugins/rabbitmq_delayed_message_exchange.ez \
    https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/v3.12.0/rabbitmq_delayed_message_exchange-3.12.0.ez

# Ensure correct permissions
RUN chmod 644 /plugins/rabbitmq_delayed_message_exchange.ez
