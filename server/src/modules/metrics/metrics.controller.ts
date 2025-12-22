import { Controller, Get } from "@nestjs/common";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { Counter } from "prom-client";
import { Public } from "../../common/decorators/public.decorator";

@Public()
@Controller("metrics")
export class MetricsController {
  constructor(
    @InjectMetric("http_requests_total") private counter: Counter<string>
  ) {}

  @Get()
  getMetrics() {
    this.counter.inc(); // increment on scrape
    return "Metrics endpoint for Prometheus";
  }
}
