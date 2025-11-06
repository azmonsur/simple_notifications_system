import { getChannel, requeueOrDLQ } from '../utils/rabbitmq';
import { logger } from '../utils/logger';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || '' });

(async()=>{
  const ch = await getChannel();
  // allow multiple concurrent messages
  ch.prefetch(parseInt(process.env.WORKER_PREFETCH || '50', 10));
  ch.consume(process.env.RABBITMQ_DELIVERY_QUEUE || 'notifications.delivery', async (msg:any) => {
    if(!msg) return;
    const job = JSON.parse(msg.content.toString());
    if(job.channel !== 'sms') { ch.nack(msg,false,false); return; }
    try {
      const res = await pool.query('SELECT destination_encrypted, template_vars, attempts, id FROM notifications WHERE id=$1',[job.notif_id]);
      const row = res.rows[0];
      if(!row){ ch.ack(msg); return; }
      // TODO: decrypt destination and call SMS gateway here
      logger.info('SMS worker would send', job.notif_id);
      // on success
      await pool.query('UPDATE notifications SET status=$1, attempts=$2, updated_at=now() WHERE id=$3', ['sent', (row.attempts || 0) + 1, job.notif_id]);
      ch.ack(msg);
    } catch (err:any) {
      logger.error('SMS worker error', err);
      await requeueOrDLQ({ ...job, last_error: String(err) });
      ch.ack(msg); // ack because we've handled requeue/dlq
    }
  }, { noAck: false });
})();