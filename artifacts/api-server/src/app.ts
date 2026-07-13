import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import cookieParser from "cookie-parser";
import router from './routes/index.js';
import { logger } from './lib/logger.js';
import { loadUser } from './middlewares/loadUser.js';
import path from "path";
import fs from "fs";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser(process.env["SESSION_SECRET"] ?? "dev-insecure-secret"));
app.use(loadUser);

app.use("/api", router);

// Serve static uploaded files under /api/uploads
const uploadDir = process.env.VERCEL
  ? "/tmp"
  : path.resolve(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/api/uploads", express.static(uploadDir));

export default app;
