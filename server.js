import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is not set");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const cbcCurriculum = {
  prePrimary: {
    label: "Pre-Primary (PP1-PP2)",
    subjects: [
      "Language Activities",
      "Mathematical Activities",
      "Environmental Activities",
      "Psychomotor & Creative Activities",
      "Religious Education",
    ],
  },
  lowerPrimary: {
    label: "Lower Primary (Grades 1-3)",
    subjects: [
      "English",
      "Kiswahili",
      "Mathematics",
      "Environmental Activities",
      "Hygiene & Nutrition",
      "Movement & Creative Activities",
      "Religious Education",
    ],
  },
  upperPrimary: {
    label: "Upper Primary (Grades 4-6)",
    subjects: [
      "English",
      "Kiswahili",
      "Home Science",
      "Agriculture",
      "Science & Technology",
      "Mathematics",
      "Social Studies",
      "Creative Arts",
      "Religious Education",
      "Physical & Health Education",
    ],
  },
  juniorSecondary: {
    label: "Junior Secondary (Grades 7-9)",
    subjects: [
      "English",
      "Kiswahili",
      "Mathematics",
      "Integrated Science",
      "Social Studies",
      "Pre-Technical & Pre-Career Education",
      "Business Studies",
      "Agriculture",
      "Religious Education",
      "Sports & Physical Education",
      "Life Skills",
      "Health Education",
    ],
  },
  seniorSecondary: {
    label: "Senior Secondary (Grades 10-12)",
    pathways: {
      stem: [
        "English",
        "Mathematics",
        "Physics",
        "Chemistry",
        "Biology",
        "Computer Science",
      ],
      socialSciences: [
        "English",
        "Mathematics",
        "History",
        "Geography",
        "Economics",
        "Government",
      ],
      performingArts: [
        "English",
        "Mathematics",
        "Music",
        "Visual Arts",
        "Performing Arts",
        "Drama",
      ],
    },
  },
};

const grades = {
  pp1: "Pre-Primary 1",
  pp2: "Pre-Primary 2",
  grade1: "Grade 1",
  grade2: "Grade 2",
  grade3: "Grade 3",
  grade4: "Grade 4",
  grade5: "Grade 5",
  grade6: "Grade 6",
  grade7: "Grade 7",
  grade8: "Grade 8",
  grade9: "Grade 9",
  grade10: "Grade 10",
  grade11: "Grade 11",
  grade12: "Grade 12",
};

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});

app.use("/api/", limiter);

const validateGenerateRequest = (req, res, next) => {
  const { topic, grade, subject, contentType, language } = req.body;

  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Topic is required and must be a non-empty string",
    });
  }

  if (!grade || !Object.keys(grades).includes(grade)) {
    return res.status(400).json({
      success: false,
      error: `Grade must be one of: ${Object.keys(grades).join(", ")}`,
    });
  }

  if (subject && typeof subject !== "string") {
    return res.status(400).json({
      success: false,
      error: "Subject must be a string",
    });
  }

  if (
    !contentType ||
    ![
      "lesson-summary",
      "quiz",
      "activity",
      "assessment",
      "explanation",
    ].includes(contentType)
  ) {
    return res.status(400).json({
      success: false,
      error:
        "Content type must be: lesson-summary, quiz, activity, assessment, or explanation",
    });
  }

  if (!language || !["English", "Kiswahili"].includes(language)) {
    return res.status(400).json({
      success: false,
      error: "Language must be: English or Kiswahili",
    });
  }

  next();
};

const generateCBCPrompt = (topic, grade, subject, contentType, language) => {
  const gradeLabel = grades[grade];
  const languageContext =
    language === "Kiswahili" ? "in Kiswahili" : "in English";
  const cbcContext = `This is for the Kenyan CBC curriculum at ${gradeLabel}${
    subject ? ` in ${subject}` : ""
  }`;

  const contentPrompts = {
    "lesson-summary": `Create a concise lesson summary for "${topic}" ${languageContext}. ${cbcContext}. Focus on key competencies students should develop. Include 2-3 main learning outcomes and key concepts. Keep it teacher-friendly.`,

    quiz: `Generate 5 multiple-choice questions for "${topic}" ${languageContext}. ${cbcContext}. Format: Q1) Question? A) Option B) Option C) Option D) Correct Answer: X. Ensure questions test competency-based learning, not just rote memorization.`,

    activity: `Design a practical, real-life activity for students to learn "${topic}" ${languageContext}. ${cbcContext}. Include: Objective, Materials needed, Step-by-step instructions, Expected outcomes, and Connection to real-world application. Make it engaging and hands-on.`,

    assessment: `Create a competency-based assessment for "${topic}" ${languageContext}. ${cbcContext}. Include rubric, success criteria, and how to measure student competency development.`,

    explanation: `Explain "${topic}" ${languageContext} in simple, relatable terms. ${cbcContext}. Use local Kenyan examples, case studies, or real-life scenarios to make content relevant and engaging to students.`,
  };

  return contentPrompts[contentType];
};

app.post("/api/generate", validateGenerateRequest, async (req, res) => {
  try {
    const {
      topic,
      grade,
      subject,
      contentType = "lesson-summary",
      language = "English",
    } = req.body;

    const prompt = generateCBCPrompt(
      topic,
      grade,
      subject,
      contentType,
      language
    );

    const result = await model.generateContent(prompt);
    const content = result.response.text();

    res.json({
      success: true,
      data: {
        topic,
        grade,
        gradeLabel: grades[grade],
        subject: subject || "General",
        contentType,
        language,
        content,
        generatedAt: new Date().toISOString(),
        cbcAligned: true,
      },
      metadata: {
        model: "gemini-pro",
        curriculum: "Kenyan CBC",
        inputTokens: result.response.promptFeedback?.inputTokenCount || 0,
      },
    });
  } catch (error) {
    console.error("Generate error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate content",
      details: error.message,
    });
  }
});

app.post("/api/teacher-materials", async (req, res) => {
  try {
    const { topic, grade, subject, language = "English" } = req.body;

    if (!topic || !grade) {
      return res.status(400).json({
        success: false,
        error: "Topic and grade are required",
      });
    }

    const gradeLabel = grades[grade];
    const languageContext =
      language === "Kiswahili" ? "in Kiswahili" : "in English";

    const prompt = `Create comprehensive teacher materials for "${topic}" at ${gradeLabel} ${languageContext}. Include: 1) Learning objectives aligned with CBC competencies, 2) Lesson outline (30-45 min), 3) Differentiation strategies, 4) Common misconceptions and how to address them, 5) Home support activities. Make it practical and classroom-ready.`;

    const result = await model.generateContent(prompt);
    const materials = result.response.text();

    res.json({
      success: true,
      data: {
        topic,
        grade,
        gradeLabel,
        subject: subject || "General",
        language,
        teacherMaterials: materials,
      },
    });
  } catch (error) {
    console.error("Teacher materials error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate teacher materials",
      details: error.message,
    });
  }
});

app.post("/api/clarify", async (req, res) => {
  try {
    const { previousContent, question, grade, language = "English" } = req.body;

    if (!previousContent || !question || !grade) {
      return res.status(400).json({
        success: false,
        error: "previousContent, question, and grade are required",
      });
    }

    const gradeLabel = grades[grade];
    const languageContext = language === "Kiswahili" ? "Kiswahili" : "English";
    const prompt = `Based on this CBC content for ${gradeLabel}: "${previousContent}", answer this follow-up question: "${question}" in ${languageContext}. Be clear, age-appropriate, and competency-focused.`;

    const result = await model.generateContent(prompt);
    const clarification = result.response.text();

    res.json({
      success: true,
      data: {
        question,
        clarification,
        grade,
      },
    });
  } catch (error) {
    console.error("Clarify error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate clarification",
      details: error.message,
    });
  }
});

app.post("/api/learning-path", async (req, res) => {
  try {
    const {
      topic,
      startGrade,
      endGrade,
      subject,
      language = "English",
    } = req.body;

    if (!topic || !startGrade || !endGrade) {
      return res.status(400).json({
        success: false,
        error: "Topic, startGrade, and endGrade are required",
      });
    }

    const startLabel = grades[startGrade];
    const endLabel = grades[endGrade];
    const languageContext =
      language === "Kiswahili" ? "in Kiswahili" : "in English";

    const prompt = `Create a learning progression for "${topic}" from ${startLabel} to ${endLabel} ${languageContext}. For each level, outline: Competency to develop, Key concepts, Assessment criteria, and Connection to next level. Align with Kenyan CBC principles.`;

    const result = await model.generateContent(prompt);
    const learningPath = result.response.text();

    res.json({
      success: true,
      data: {
        topic,
        startGrade: startLabel,
        endGrade: endLabel,
        subject: subject || "Cross-curricular",
        language,
        learningPath,
      },
    });
  } catch (error) {
    console.error("Learning path error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate learning path",
      details: error.message,
    });
  }
});

app.get("/api/metadata", (req, res) => {
  res.json({
    success: true,
    data: {
      curriculum: "Kenyan Competency-Based Curriculum (CBC)",
      supportedGrades: Object.keys(grades),
      gradeLabels: grades,
      cbcLevels: {
        prePrimary: cbcCurriculum.prePrimary,
        lowerPrimary: cbcCurriculum.lowerPrimary,
        upperPrimary: cbcCurriculum.upperPrimary,
        juniorSecondary: cbcCurriculum.juniorSecondary,
        seniorSecondary: cbcCurriculum.seniorSecondary,
      },
      supportedContentTypes: [
        "lesson-summary",
        "quiz",
        "activity",
        "assessment",
        "explanation",
      ],
      supportedLanguages: ["English", "Kiswahili"],
      features: [
        "CBC-aligned lesson summaries",
        "Multiple-choice quizzes",
        "Real-life activities",
        "Teacher support materials",
        "Learning path planning",
        "Competency-based assessments",
      ],
    },
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is running" });
});

// Start server
app.listen(PORT, () => {
  console.log(`CBC Smart Study Assistant server running on port ${PORT}`);
});
