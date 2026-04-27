import "dotenv/config";
import express from "express";
import cors from "cors";
import router from "./routes.js";

const app = express();
const PORT = process.env.PORT ||

app.use(cors());              // ✅ ADD THIS
app.use(express.json());
app.use("/api", router);

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});