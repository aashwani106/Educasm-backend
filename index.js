import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import  gptRoutes  from "./routes/gptRoutes.js"
import rateLimit from "express-rate-limit";


dotenv.config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());


const rateLimitHandler = (req, res, next, options) => {
  console.log(
    `⛔ Rate limit exceeded for IP: ${req.ip} | Route: ${req.originalUrl} | Limit: ${options.max} requests`
  );
  res.status(203).json({ message: options.message ,limitReached : true });
};


// Rate limiters with backend logging
const minuteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // 15 requests per minute
  message: "Too many requests, please try again later.",
  handler: rateLimitHandler,
});

const hourLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 250, // 250 requests per hour
  message: "Hourly request limit exceeded. Try again later.",
  handler: rateLimitHandler,
});

const dayLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 1 day
  max: 500, // 500 requests per day
  message: "Daily request limit exceeded. Come back tomorrow.",
  handler: rateLimitHandler,
});


// Apply rate limiters globally or to specific routes
// app.use(minuteLimiter);
// app.use(hourLimiter);
// app.use(dayLimiter);

// Initialize OpenAI with API Key
const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY });

// app.use("/api/gpt", gptRoutes);
app.use("/api/gpt", minuteLimiter, hourLimiter, dayLimiter, gptRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
