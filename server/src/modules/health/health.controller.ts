import { Controller, Get, Head } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get()
  rootGet() {
    return { status: "ok" };
  }

  @Head()
  rootHead() {
    // HEAD responses should not have a body
    return;
  }

  @Get("health")
  health() {
    return { status: "healthy" };
  }
}
