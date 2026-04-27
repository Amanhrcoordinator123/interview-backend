import express from "express";
import cors from "cors";
import router from "./routes.js";

const app = express();

// ✅ TEMPORARY: allow all origins (FINAL TEST FIX)
app.use(cors());

app.use(express.json());
app.use("/api", router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
