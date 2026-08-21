const express = require("express");
const { buildAgentSystemPrompt } = require("../agent/whiteboardKnowledge");

const router = express.Router();

const OLLAMA_BASE = (
  process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
).replace(/\/+$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";
const CHAT_TIMEOUT_MS = 120_000;

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-24).map((m) => ({
    role:
      m.role === "assistant"
        ? "assistant"
        : m.role === "system"
          ? "system"
          : "user",
    content: String(m.content || "").slice(0, 8000),
  }));
}

router.get("/health", async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) {
      return res.status(502).json({
        ok: false,
        error: "Ollama did not respond. Start it with: ollama serve",
      });
    }
    const data = await r.json();
    const models = (data.models || []).map((m) => m.name);
    const modelReady = models.some(
      (name) => name === OLLAMA_MODEL || name.startsWith(`${OLLAMA_MODEL}:`)
    );
    return res.json({
      ok: true,
      baseUrl: OLLAMA_BASE,
      model: OLLAMA_MODEL,
      modelReady,
      models,
    });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error:
        e.message ||
        "Cannot reach Ollama at " +
          OLLAMA_BASE +
          ". Run: ollama serve && ollama pull qwen2.5:3b",
    });
  }
});

router.post("/chat", async (req, res) => {
  const cleaned = cleanMessages(req.body?.messages);
  if (!cleaned.length) {
    return res.status(400).json({ error: "messages array required" });
  }

  const roomId =
    typeof req.body?.roomId === "string" ? req.body.roomId.trim().slice(0, 80) : "";
  const displayName =
    typeof req.body?.displayName === "string"
      ? req.body.displayName.trim().slice(0, 48)
      : "";
  const role =
    typeof req.body?.role === "string" ? req.body.role.trim().slice(0, 24) : "";

  const systemContent = buildAgentSystemPrompt({ roomId, displayName, role });

  const payload = {
    model: OLLAMA_MODEL,
    messages: [
      { role: "system", content: systemContent },
      ...cleaned.filter((m) => m.role !== "system"),
    ],
    stream: false,
    options: {
      temperature: 0.35,
      num_predict: 512,
      num_ctx: 8192,
    },
  };

  try {
    const r = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return res.status(502).json({
        error:
          errText ||
          `Ollama chat failed (${r.status}). Pull the model: ollama pull ${OLLAMA_MODEL}`,
      });
    }

    const data = await r.json();
    const reply = String(data.message?.content || "").trim();
    if (!reply) {
      return res.status(502).json({ error: "Empty response from Ollama" });
    }

    return res.json({ reply, model: OLLAMA_MODEL });
  } catch (e) {
    return res.status(502).json({
      error:
        e.message ||
        `Could not reach Ollama. Ensure it is running: ollama run ${OLLAMA_MODEL}`,
    });
  }
});

module.exports = router;
