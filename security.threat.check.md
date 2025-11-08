1. **Parameterized Queries**

   - Why: Prevents SQL injection attacks
   - Example:

   ```typescript
   // Good
   const users = await this.repo.find({ where: { id: userId } });

   // Bad
   const users = await this.repo.query(
     `SELECT * FROM users WHERE id = ${userId}`
   );
   ```

2. **Password Security**

   - Why: Protects user credentials if database is compromised
   - Example:

   ```typescript
   import * as bcrypt from "bcrypt";

   const hashedPassword = await bcrypt.hash(password, 10);
   const isMatch = await bcrypt.compare(password, hashedPassword);
   ```

3. **Rate Limiting**

   - Why: Prevents brute force and DoS attacks
   - Example:

   ```typescript
   @ThrottlerGuard(
     ThrottlerModule.forRoot({
       ttl: 60,
       limit: 10,
     })
   )
   export class AuthController {}
   ```

4. **DTO Validation**

   - Why: Ensures data integrity
   - Example:

   ```typescript
   export class CreateUserDto {
     @IsString()
     @MinLength(3)
     username: string;

     @IsEmail()
     email: string;
   }
   ```

5. **Security Headers**

   - Why: Protects against XSS
   - Example:

   ```typescript
   app.use(
     helmet({
       contentSecurityPolicy: {
         directives: {
           defaultSrc: ["'self'"],
           scriptSrc: ["'self'"],
         },
       },
     })
   );
   ```

6. **Request Validation**

   - Why: Prevents memory attacks
   - Example:

   ```typescript
   app.use(express.json({ limit: "10kb" }));
   ```

7. **Database Security**

   - Why: Minimizes attack surface
   - Example:

   ```sql
   CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'password';
   GRANT SELECT, INSERT ON app_db.users TO 'app_user'@'localhost';
   ```

8. **Transport Security**

   - Why: Prevents MITM attacks
   - Example:

   ```typescript
   const options = {
     key: fs.readFileSync("private-key.pem"),
     cert: fs.readFileSync("certificate.pem"),
   };
   https.createServer(options, app);
   ```

9. **Security Monitoring**

   - Why: Detects breaches
   - Example:

   ```typescript
   const logger = winston.createLogger({
     level: "warn",
     format: winston.format.json(),
     transports: [new winston.transports.File({ filename: "security.log" })],
   });
   ```

10. **Dependency Security**

    - Why: Prevents vulnerabilities
    - Example:

    ```json
    {
      "scripts": {
        "security-check": "npm audit"
      }
    }
    ```

11. Add queueing/workers in the future for extremely high-throughput endpoints. ```
