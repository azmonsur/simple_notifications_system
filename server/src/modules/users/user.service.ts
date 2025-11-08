// src/modules/users/user.service.ts
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { query as dbQuery } from "../../utils/db";

@Injectable()
export class UserService {
  private logger = new Logger("UserService");

  // Retry helper for DB queries
  private async retryQuery(sql: string, values: any[], retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await dbQuery(sql, values);
      } catch (err: any) {
        this.logger.warn(
          `DB query failed (attempt ${attempt}): ${err.message}`
        );
        if (attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, 200 * attempt)); // backoff
      }
    }
  }

  // Create user
  async createUser(
    data: {
      username: string;
      first_name: string;
      last_name: string;
      age: number;
      gender: string;
    },
    ip: string
  ) {
    const sql = `
      INSERT INTO users (username, first_name, last_name, age, gender)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    try {
      const result = await this.retryQuery(sql, [
        data.username,
        data.first_name,
        data.last_name,
        data.age,
        data.gender,
      ]);
      this.logger.log(`User created: ${data.username}`);
      return result?.rows[0];
    } catch (err: any) {
      this.logger.error(
        `Failed to create user ${data.username}: ${err.message}`,
        err.stack
      );
      throw new InternalServerErrorException("Database error");
    }
  }
}
