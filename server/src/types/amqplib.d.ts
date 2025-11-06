declare module "amqplib" {
  import { EventEmitter } from "events";

  export interface Connection extends EventEmitter {
    createChannel(): Promise<Channel>;
    close(): Promise<void>;
  }

  export interface Channel extends EventEmitter {
    assertQueue(queue: string, options?: any): Promise<any>;
    sendToQueue(queue: string, content: Buffer, options?: any): boolean;
    consume(
      queue: string,
      onMessage: (msg: any | null) => void,
      options?: any
    ): Promise<any>;
    ack(msg: any): void;
    nack(msg: any, allUpTo?: boolean, requeue?: boolean): void;
    close(): Promise<void>;
  }

  export function connect(url: string): Promise<Connection>;
}
