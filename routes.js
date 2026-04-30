import express from "express";
import multer from "multer";
import { supabase } from "./supabase.js";
import { randomUUID } from "crypto";

const router = express.Router();

// ================== MULTER SETUP ==================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// ================== HEALTH CHECK ==================
router.get("/ping", (_req, res) => {
  res.json({ status: "ok", message: "server is reachable" });
});

// ================== ROLES ==================
router.get("/roles", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("roles")
      .select("id, name");

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== QUESTIONS ==================
router.get("/questions/:roleId", async (req, res) => {
  const { roleId } = req.params;

  const { data, error } = await supabase
    .from("questions")
    .select("id, question_text, order_index")
    .eq("role_id", roleId)
    .order("order_index");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// ================== START INTERVIEW ==================
router.post("/interview/start", async (req, res) => {
  try {
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
      return res.status(400).json({
        error: "Invalid role or no questions configured"
      });
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== AUDIO UPLOAD (PHASE B) ==================
router.post(
  "/interview/upload-audio",
  upload.single("audio"),
  async (req, res) => {
    try {
      const { sessionId, questionId } = req.body;

      if (!sessionId || !questionId) {
        return res.status(400).json({
          error: "sessionId and questionId are required"
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "No audio file uploaded"
        });
      }

      console.log("✅ Audio received:", {
        sessionId,
        questionId,
        size: req.file.size,
        type: req.file.mimetype
      });

      // Phase B: acknowledge receipt only
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Audio upload failed" });
    }
  }
);

// ================== SUBMIT INTERVIEW ==================
router.post("/interview/submit", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const { data: session, error: fetchError } = await supabase
      .from("interview_sessions")
      .select("status")
      .eq("id", sessionId)
      .single();

    if (fetchError || !session) {
      return res.status(404).json({ error: "Interview session not found" });
    }

    if (session.status === "COMPLETED") {
      return res.status(400).json({
        error: "Interview already submitted"
      });
    }

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
