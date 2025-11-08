import cluster from "cluster";
import { cpus } from "os";
import bootstrap from "./main";

if (cluster.isPrimary) {
  const numCPUs = cpus().length;
  console.log(`Primary process running, spawning ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) cluster.fork();

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  bootstrap();
}
