import express from "express";
import multer from "multer";
import { supabase } from "./supabase.js";
import { randomUUID } from "crypto";

const router = express.Router();
// TEMP DEBUG: list storage buckets
router.get("/debug/buckets", async (_req, res) => {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    res.json({ data, error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/ping", (_req, res) => {
  res.json({ status: "ok", message: "server is reachable" });
});

// GET roles
router.get("/roles", async (_req, res) => {
  try {
    const { data, error } = await supabase.from("roles").select("id, name");
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET questions
router.get("/questions/:roleId", async (req, res) => {
  const { roleId } = req.params;
  const { data, error } = await supabase
    .from("questions")
    .select("id, question_text, order_index")
    .eq("role_id", roleId)
    .order("order_index");

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// START interview
router.post("/interview/start", async (req, res) => {
  const { email, roleId } = req.body;

  if (!email || !roleId) {
    return res.status(400).json({ error: "Email and role are required" });
  }

  const { data: existing } = await supabase
    .from("interview_sessions")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: "Email already used" });
  }

  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_text, order_index")
    .eq("role_id", roleId)
    .order("order_index");

  if (!questions || questions.length === 0) {
    return res.status(400).json({ error: "Invalid role or no questions configured" });
  }

  const sessionId = randomUUID();

  await supabase.from("interview_sessions").insert({
    id: sessionId,
    email,
    role_id: roleId,
    status: "IN_PROGRESS"
  });

  res.json({
    sessionId,
    totalQuestions: questions.length,
    questions: questions.map(q => ({
      id: q.id,
      text: q.question_text
    }))
  });
});

// ✅ THIS LINE MUST EXIST
// ===== AUDIO UPLOAD ENDPOINT =====

const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

router.post(
  "/interview/upload-audio",
  upload.single("audio"),
  async (req, res) => {
    try {
      const { sessionId, questionId, retryCount } = req.body;

      if (!sessionId || !questionId || retryCount === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Audio file missing" });
      }

      if (Number(retryCount) > 3) {
        return res.status(400).json({ error: "Retry limit exceeded" });
      }

      // Check interview session
      const { data: session } = await supabase
        .from("interview_sessions")
        .select("status")
        .eq("id", sessionId)
        .single();

      if (!session || session.status !== "IN_PROGRESS") {
        return res.status(400).json({ error: "Interview not active" });
      }

      const filePath = `${sessionId}/question-${questionId}.webm`;

      // Upload to Supabase Storage
console.log("Uploading to bucket: interviews");
   const uploadUrl = `${process.env.SUPABASE_URL}/storage/v1/object/interviews/${filePath}`;

const uploadResponse = await fetch(uploadUrl, {
  method: "PUT",
  headers: {
    "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    "apikey": process.env.SUPABASE_SERVICE_KEY, // ✅ REQUIRED
    "Content-Type": req.file.mimetype,
    "x-upsert": "true"
  },
  body: req.file.buffer
});

if (!uploadResponse.ok) {
  const errText = await uploadResponse.text();
  return res.status(500).json({ error: errText });
}

      if (uploadError) {
        return res.status(500).json({ error: uploadError.message });
      }

      // Save or update response
      const { error: dbError } = await supabase
        .from("responses")
        .upsert({
          session_id: sessionId,
          question_id: questionId,
          audio_path: filePath,
          retry_count: retryCount
        });

      if (dbError) {
        return res.status(500).json({ error: dbError.message });
      }

      res.json({
        success: true,
        message: "Audio uploaded successfully"
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);
``
// ===== SUBMIT INTERVIEW =====
router.post("/interview/submit", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    // 1️⃣ Fetch the interview session
    const { data: session, error: fetchError } = await supabase
      .from("interview_sessions")
      .select("status")
      .eq("id", sessionId)
      .single();

    if (fetchError || !session) {
      return res.status(404).json({ error: "Interview session not found" });
    }

    // 2️⃣ Prevent double submission
    if (session.status === "COMPLETED") {
      return res.status(400).json({ error: "Interview already submitted" });
    }

    // 3️⃣ Mark interview as completed
    const { error: updateError } = await supabase
      .from("interview_sessions")
      .update({
        status: "COMPLETED",
        completed_at: new Date()
      })
      .eq("id", sessionId);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    res.json({
      success: true,
      message: "Interview submitted successfully"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default router;