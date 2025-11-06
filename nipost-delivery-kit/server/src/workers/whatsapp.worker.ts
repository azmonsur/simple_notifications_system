import fetch from 'node-fetch';
import { getChannel, requeueOrDLQ } from '../utils/rabbitmq';
import { logger } from '../utils/logger';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || '' });

(async()=>{
  const ch = await getChannel();
  ch.prefetch(parseInt(process.env.WORKER_PREFETCH || '50', 10));
  ch.consume(process.env.RABBITMQ_DELIVERY_QUEUE || 'notifications.delivery', async (msg:any) => {
    if(!msg) return;
    const job = JSON.parse(msg.content.toString());
    if(job.channel !== 'whatsapp') { ch.nack(msg,false,false); return; }
    try {
      const res = await pool.query('SELECT destination_encrypted, template_vars, attempts, id FROM notifications WHERE id=$1',[job.notif_id]);
      const row = res.rows[0];
      if(!row){ ch.ack(msg); return; }
      // decrypt destination and send via Meta WhatsApp Cloud API
      logger.info('WhatsApp worker sending', job.notif_id);
      // placeholder: actual send logic here
      await pool.query('UPDATE notifications SET status=$1, attempts=$2, updated_at=now() WHERE id=$3', ['sent', (row.attempts || 0) + 1, job.notif_id]);
      ch.ack(msg);
    } catch (err:any) {
      logger.error('WhatsApp worker error', err);
      await requeueOrDLQ({ ...job, last_error: String(err) });
      ch.ack(msg);
    }
  }, { noAck: false });
})();