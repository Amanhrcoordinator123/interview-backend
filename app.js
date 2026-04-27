import express from "express";
import cors from "cors";
import router from "./routes.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://interview-2026.netlify.app",
  "https://69ef9ac45cc4fd58a2e6d0d0--interview-2026.netlify.app"
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("CORS not allowed"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());
app.use("/api", router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
``