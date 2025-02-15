import express from "express";

import GPTService from "../services/gptServices.js";

const router = express.Router();
const gptService = new GPTService();

router.post("/question", async (req, res) => {
  try {
    console.log("Request received fro question");
    const { topic, level, userContext } = req.body;
    const question = await gptService.getPlaygroundQuestion(
      topic,
      level,
      userContext
    );
    console.log("final res", question);
    res.json({ data: question, error: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/getTestQuestions", async (req, res) => {
  try {
    console.log("Request received for test questions", req.body);

    const { topic, examType } = req.body;

    const question = await gptService.getTestQuestions(topic, examType);
    console.log("final res", question);
    res.json({ data: question, error: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/getExploreContent", async (req, res) => {
  try {
    console.log("Request received for getExploreContent");
    const { query, userContext } = req.body;
    const question = await gptService.exploreQuery(query, userContext);
    console.log("final res", question);
    res.json({ data: question, error: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/streamExploreContent", async (req, res) => {
  try {
    const { query, userContext } = req.body;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Transfer-Encoding", "chunked");
    console.log("Request received for streamExploreContent");
    await gptService.streamExploreContent(query, userContext, (chunk) => {
      res.write(JSON.stringify(chunk) + "\n"); // Send each chunk
    });

    res.end();
  } catch (error) {
    console.error("Error in streaming:", error);
    res.status(500).json({ error: "Streaming failed" });
  } 
});

export default router;
