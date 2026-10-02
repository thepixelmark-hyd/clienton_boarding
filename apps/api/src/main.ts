import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: { origin: process.env.WEB_APP_URL, credentials: true } });

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix("api/v1");
  // Validation is per-route via ZodValidationPipe (packages/shared schemas),
  // not Nest's class-validator-based ValidationPipe — see docs/architecture.md.

  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("ClientOS API")
      .setDescription("Client Delivery Operating System — internal API")
      .setVersion("0.1.0")
      .addCookieAuth(process.env.SESSION_COOKIE_NAME ?? "clientos_session")
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = process.env.API_PORT ?? 9004;
  await app.listen(port);
  Logger.log(`ClientOS API listening on port ${port}`, "Bootstrap");
}

bootstrap();
