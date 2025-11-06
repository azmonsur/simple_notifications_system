declare module "amqplib/channel_api" {
  export interface Connection {
    createChannel(): Promise<Channel>;
    close(): Promise<void>;
  }

  export interface Channel {
    assertQueue(queue: string, options?: any): Promise<void>;
    sendToQueue(queue: string, content: Buffer, options?: any): boolean;
    close(): Promise<void>;
  }
}
