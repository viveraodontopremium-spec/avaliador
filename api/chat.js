export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const { messages, systemPrompt, senha } = req.body;

  if (!senha || senha.trim() !== "123") {
    return res.status(401).json({ error: "senha_invalida" });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Mensagens inválidas" });
  }

  const GEMINI_KEY = process.env.GEMINI_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: "GEMINI_KEY não configurada" });
  }

  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  // Injeta system prompt como primeira troca de mensagens
  const allContents = systemPrompt ? [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Entendido. Estou pronto." }] },
    ...contents
  ] : contents;

  const body = {
    contents: allContents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000
    }
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      return res.status(500).json({ error: "Gemini erro " + response.status, detail: err.slice(0, 300) });
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!content) {
      return res.status(500).json({ error: "Resposta vazia do Gemini" });
    }

    return res.status(200).json({ content });

  } catch (err) {
    return res.status(500).json({ error: "Erro interno: " + err.message });
  }
}
