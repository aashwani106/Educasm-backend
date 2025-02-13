import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function streamExploreContent(req, res) {
  const { query, userContext } = req.body;
  

  if (!query || !userContext) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const systemPrompt = `You are a Gen-Z tutor who explains complex topics concisely for a ${userContext.age} year old.
      First provide the explanation in plain text, then provide related content in a STRICT single-line JSON format.

      Structure your response exactly like this:

      <paragraph 1>

      <paragraph 2>

      <paragraph 3>

      ---
      {"topics":[{"name":"Topic","type":"prerequisite","detail":"Why"}],"questions":[{"text":"Q?","type":"curiosity","detail":"Context"}]}

      RULES:
      - ADAPT CONTENT FOR ${userContext.age} YEAR OLD:
      - STRICT LENGTH LIMITS (80 words max)
      - MUST provide EXACTLY 5 related topics and 5 questions
      - Keep paragraphs clear and simple
      - JSON must be in a single line`;

    const userPrompt = `Explain "${query}" in three concise paragraphs for a ${userContext.age} year old:
      1. Basic definition (15-20 words)
      2. Key details (15-20 words)
      3. Direct applications and facts (15-20 words)
      
      Then provide:
      - 5 related topics (age-appropriate)
      - 5 curiosity-driven questions (8-12 words each)
      
      Follow the format strictly.`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
      temperature: 0.7,
    });

    let mainContent = "";
    let jsonContent = "";
    let isJsonSection = false;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";

      if (content.includes("---")) {
        isJsonSection = true;
        continue;
      }

      if (isJsonSection) {
        jsonContent += content;
        try {
          if (jsonContent.includes("}")) {
            const parsed = JSON.parse(jsonContent.trim());
            res.write(`data: ${JSON.stringify(parsed)}\n\n`);
          }
        } catch (error) {
          console.debug("JSON parse error:", error);
        }
      } else {
        mainContent += content;
        res.write(`data: ${JSON.stringify({ text: mainContent.trim() })}\n\n`);
      }
    }

    res.end();
  } catch (error) {
    console.error("Streaming error:", error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = { streamExploreContent };
