import express, { type Express } from "express";
import cors from "cors";
import router from "./routes/index.js";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Preserve `/api/*` paths for both local Vite proxying and Vercel rewrites.
app.use("/api", router);

export default app;
