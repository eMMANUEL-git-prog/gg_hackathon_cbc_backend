import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });

app.get("/", (req, res) => {
  res.json({ message: "CBC Smart Study Assistant Backend is running" });
});

app.post("/api/gemini", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic || topic.trim() === "") {
      return res.status(400).json({ error: "Please provide a topic." });
    }

    const prompt = `
You are an excellent Kenyan CBC Grade 6 teacher who communicates strictly in clear English (no Swahili or code-switching).

Explain the topic "${topic}" simply and provide the following:

1. A 3–4 sentence English summary written in a warm, friendly tone suitable for Grade 6 learners.  
2. Three multiple-choice quiz questions (each with four options and one clearly marked correct answer).  
3. One practical, real-life activity that helps learners understand the topic better.

Respond in **this exact structured format** (use clear labels):

SUMMARY:
...

QUIZ:
1)
2)
3)

ACTIVITY:
...

Do not include any extra introductions, translations, or closing remarks — just the sections above in English.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({ output: text });
  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "Failed to generate content" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
