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
    const { token, email } = req.body;

    if (!token) {
      return res.status(401).json({
        error: "Interview access token is required"
      });
    }

    // 1️⃣ Validate token
    const { data: tokenRow, error: tokenError } = await supabase
      .from("interview_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRow) {
      return res.status(401).json({ error: "Invalid interview token" });
    }

    if (!tokenRow.is_active) {
      return res.status(403).json({ error: "Interview access revoked" });
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return res.status(403).json({ error: "Interview token expired" });
    }

    // Optional: bind token to email
    if (tokenRow.email && tokenRow.email !== email) {
      return res.status(403).json({ error: "Email does not match token" });
    }

    // Optional: one‑time use enforcement
    if (tokenRow.used_at) {
      return res.status(403).json({ error: "Interview token already used" });
    }

    // 2️⃣ Fetch interview questions for the role
    const { data: questions, error: qError } = await supabase
      .from("questions")
      .select("id, question_text, order_index")
      .eq("role_id", tokenRow.role_id)
      .order("order_index");

    if (qError || !questions || questions.length === 0) {
      return res.status(400).json({
        error: "No questions configured for this role"
      });
    }

    // 3️⃣ Create interview session
    const sessionId = crypto.randomUUID();

    await supabase.from("interview_sessions").insert({
      id: sessionId,
      email,
      role_id: tokenRow.role_id,
      status: "IN_PROGRESS"
    });

    // 4️⃣ Mark token as used
    await supabase
      .from("interview_tokens")
      .update({ used_at: new Date() })
      .eq("id", tokenRow.id);

    res.json({
      sessionId,
      totalQuestions: questions.length,
      questions: questions.map((q) => ({
        id: q.id,
        text: q.question_text
      }))
    });
  } catch (err) {
    console.error("Start interview error:", err);
    res.status(500).json({ error: "Failed to start interview" });
  }
});

// ================== AUDIO UPLOAD (PHASE C) ==================
router.post(
  "/interview/upload-audio",
  upload.single("audio"),
  async (req, res) => {
    
    try {
      const { sessionId, questionId } = req.body;

      console.log("ENV CHECK", {
        SUPABASE_URL: process.env.SUPABASE_URL,
        HAS_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY
      });

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

      const filePath = `${sessionId}/question-${questionId}.webm`;
      console.log("Attempting upload to bucket 'interviews' at:", filePath);

      const { data, error } = await supabase.storage
        .from("interviews")
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true
        });

      if (error) {
        console.error("❌ SUPABASE STORAGE ERROR:", error);
        return res.status(500).json({
          error: error.message,
          details: error
        });
      }

      console.log("✅ STORAGE UPLOAD SUCCESS", data);

      const { error: dbError } = await supabase
  .from("responses")
  .upsert(
    {
      session_id: sessionId,
      question_id: questionId,
      audio_path: filePath,
      retry_count: 0
    },
    {
      onConflict: "session_id,question_id"
    }
  );

      if (dbError) {
        console.error("❌ DB ERROR:", dbError);
        return res.status(500).json({ error: dbError.message });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("❌ UNCAUGHT ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ================== REVIEW PLAYBACK ==================
router.get("/interview/:sessionId/responses", async (req, res) => {
  try {
    const { sessionId } = req.params;

    // 1️⃣ Fetch responses
    const { data: responses, error } = await supabase
      .from("responses")
      .select("question_id, audio_path")
      .eq("session_id", sessionId)
      .order("question_id");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // 2️⃣ Generate signed URLs
    const results = await Promise.all(
      responses.map(async (r) => {
        const { data } = await supabase.storage
          .from("interviews")
          .createSignedUrl(r.audio_path, 60 * 60); // 1 hour

        return {
          questionId: r.question_id,
          videoUrl: data?.signedUrl
        };
      })
    );

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
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
