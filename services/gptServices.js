import { OpenAI } from "openai";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default class GPTService {
  /* To get Playground Questions */
  async getPlaygroundQuestion(topic, level, userContext) {
    try {
      const aspects = [
        "core_concepts",
        "applications",
        "problem_solving",
        "analysis",
        "current_trends",
      ];

      // Randomly select an aspect to focus on
      const selectedAspect =
        aspects[Math.floor(Math.random() * aspects.length)];

      const systemPrompt = `Generate a UNIQUE multiple-choice question about ${topic}.
        Focus on: ${selectedAspect.replace("_", " ")}

        Return in this JSON format:
        {
          "text": "question text here",
          "options": ["option A", "option B", "option C", "option D"],
          "correctAnswer": RANDOMLY_PICKED_NUMBER_0_TO_3,
          "explanation": {
            "correct": "Brief explanation of why the correct answer is right (max 15 words)",
            "key_point": "One key concept to remember (max 10 words)"
          },
          "difficulty": ${level},
          "topic": "${topic}",
          "subtopic": "specific subtopic",
          "questionType": "conceptual",
          "ageGroup": "${userContext.age}"
        }

        IMPORTANT RULES FOR UNIQUENESS:
        1. For ${topic}, based on selected aspect:
           - core_concepts: Focus on fundamental principles and theories
           - applications: Focus on real-world use cases and implementations
           - problem_solving: Present a scenario that needs solution
           - analysis: Compare different approaches or technologies
           - current_trends: Focus on recent developments and future directions

        2. Question Variety:
           - NEVER use the same question pattern twice
           - Mix theoretical and practical aspects
           - Include industry-specific examples
           - Use different question formats (what/why/how/compare)
           - Incorporate current developments in ${topic}

        3. Answer Choices:
           - Make ALL options equally plausible
           - Randomly assign the correct answer (0-3)
           - Ensure options are distinct but related
           - Include common misconceptions
           - Make wrong options educational

        4. Format Requirements:
           - Question must be detailed and specific
           - Each option must be substantive
           - Explanation must cover why correct answer is right AND why others are wrong
           - Include real-world context where possible
           - Use age-appropriate language

        ENSURE HIGH ENTROPY:
        - Randomize question patterns
        - Vary difficulty within level ${level}
        - Mix theoretical and practical aspects
        - Use different companies/technologies as examples
        - Include various ${topic} scenarios

        EXPLANATION GUIDELINES:
        - Keep explanations extremely concise and clear
        - Focus on the most important point only
        - Use simple language
        - Highlight the key concept
        - No redundant information
        - Maximum 25 words total`;

      const userPrompt = `Create a completely unique ${level}/10 difficulty question about ${topic}.
        Focus on ${selectedAspect.replace("_", " ")}.
        Ensure the correct answer is randomly placed.
        Make it engaging for a ${userContext.age} year old student.
        Use current examples and trends.`;

      const content = await this.makeRequest(systemPrompt, userPrompt, 1500);

      if (!content) {
        throw new Error("Empty response received");
      }

      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
      } catch (error) {
        console.error("JSON Parse Error:", error);
        throw new Error("Invalid JSON response");
      }

      // Randomly shuffle the options and adjust correctAnswer accordingly
      const shuffled = await this.shuffleOptionsAndAnswer(parsedContent);
      console.log("suffled", shuffled);
      // Validate and format the question
      const formattedQuestion = {
        text: shuffled.text || "",
        options: shuffled.options,
        correctAnswer: shuffled.correctAnswer,
        explanation: {
          correct:
            shuffled.explanation?.correct || "Correct answer explanation",
          key_point: shuffled.explanation?.key_point || "Key learning point",
        },
        difficulty: level,
        topic: topic,
        subtopic: parsedContent.subtopic || topic,
        questionType: "conceptual",
        ageGroup: userContext.age.toString(),
      };

      if (this.validateQuestionFormat(formattedQuestion)) {
        return formattedQuestion;
      }

      throw new Error("Generated question failed validation");
    } catch (error) {
      console.error("Question generation error:", error);
      throw new Error("Failed to generate valid question");
    }
  }

  async makeRequest(systemPrompt, userPrompt, maxTokens) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      // Gemini does not have system messages, so we include it in the user prompt.
      const prompt = `${systemPrompt}\n\n${userPrompt}\n\nProvide your response in JSON format.`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: maxTokens,
        },
      });

      // Extracting response text
      const response = result.response.text();
      return response;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw new Error("Failed to generate content");
    }
  }

  async shuffleOptionsAndAnswer(question) {
    // Create array of option objects with original index
    const optionsWithIndex = question.options.map((opt, idx) => ({
      text: opt,
      isCorrect: idx === question.correctAnswer,
    }));

    // Shuffle the options
    for (let i = optionsWithIndex.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [optionsWithIndex[i], optionsWithIndex[j]] = [
        optionsWithIndex[j],
        optionsWithIndex[i],
      ];
    }

    // Find new index of correct answer
    const newCorrectAnswer = optionsWithIndex.findIndex((opt) => opt.isCorrect);

    return {
      ...question,
      options: optionsWithIndex.map((opt) => opt.text),
      correctAnswer: newCorrectAnswer,
    };
  }

  async validateQuestionFormat(question) {
    try {
      // Basic validation
      if (!question.text?.trim()) return false;
      if (!Array.isArray(question.options) || question.options.length !== 4)
        return false;
      if (question.options.some((opt) => !opt?.trim())) return false;
      if (
        typeof question.correctAnswer !== "number" ||
        question.correctAnswer < 0 ||
        question.correctAnswer > 3
      )
        return false;

      // Explanation validation
      if (
        !question.explanation?.correct?.trim() ||
        !question.explanation?.key_point?.trim()
      )
        return false;

      // Additional validation
      if (question.text.length < 10) return false; // Too short
      if (question.options.length !== new Set(question.options).size)
        return false; // Duplicates
      if (
        question.explanation.correct.length < 5 ||
        question.explanation.key_point.length < 5
      )
        return false; // Too short explanations

      return true;
    } catch (error) {
      console.error("Validation error:", error);
      return false;
    }
  }

  /* to Genrate Tests */
  async getTestQuestions(topic, examType) {
    try {
      const systemPrompt = `Create a ${examType} exam test set about ${topic}.
        Generate exactly 15 questions following this structure:
        {
          "questions": [
            {
              "text": "Clear question text",
              "options": ["A", "B", "C", "D"],
              "correctAnswer": 0,
              "explanation": "Step-by-step solution",
              "difficulty": 1,
              "topic": "${topic}",
              "subtopic": "specific concept",
              "examType": "${examType}",
              "questionType": "conceptual"
            }
          ]
        }`;

      console.log("Generating test questions...");

      const content = await this.makeRequest(
        systemPrompt,
        `Create 15 ${examType} questions about ${topic} (5 easy, 5 medium, 5 hard)`,
        3000
      );

      console.log("Received response from API");

      if (!content) {
        console.error("Empty response from API");
        throw new Error("No content received from API");
      }

      let parsed;
      try {
        parsed = JSON.parse(content);
        console.log("Successfully parsed JSON response");
      } catch (error) {
        console.error("JSON parse error:", error);
        console.log("Raw content:", content);
        throw new Error("Failed to parse API response");
      }

      if (!parsed?.questions || !Array.isArray(parsed.questions)) {
        console.error("Invalid response structure:", parsed);
        throw new Error("Invalid response structure");
      }

      console.log(`Received ${parsed.questions.length} questions`);

      const processedQuestions = parsed.questions.map((q, index) => {
        const difficulty = Math.floor(index / 5) + 1;
        return {
          text: q.text || "",
          options: Array.isArray(q.options) ? q.options : [],
          correctAnswer:
            typeof q.correctAnswer === "number" ? q.correctAnswer : 0,
          explanation: q.explanation || "",
          difficulty,
          topic,
          subtopic: q.subtopic || `${topic} Concept ${index + 1}`,
          examType,
          questionType: "conceptual",
          ageGroup: "16-18",
        };
      });

      console.log("Processed questions:", processedQuestions.length);

      const validQuestions = processedQuestions.filter((q) => {
        const isValid = this.validateQuestionFormat(q);
        if (!isValid) {
          console.log("Invalid question:", q);
        }
        return isValid;
      });

      console.log(`Valid questions: ${validQuestions.length}`);

      if (validQuestions.length >= 5) {
        const finalQuestions = validQuestions.slice(0, 15);
        console.log(`Returning ${finalQuestions.length} questions`);
        return finalQuestions;
      }

      throw new Error(
        `Only ${validQuestions.length} valid questions generated`
      );
    } catch (error) {
      console.error("Test generation error:", error);
      throw new Error(
        `Failed to generate test questions: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /*  expolre  */

  async exploreQuery(query) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const prompt = `You are a social media trend expert who explains topics by connecting them to current viral trends, memes, and pop culture moments.\n\n${this.buildPrompt(
        query
      )}`;

      const response = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 4000 },
      });

      return response?.response?.text() || "";
    } catch (error) {
      console.error("Error in exploreQuery:", error);
      return "bestie, the wifi must be acting up... let me try again";
    }
  }

  async buildPrompt(query) {
    return `
      Explain "${query}" using current social media trends, memes, and pop culture references.
      
      Content Style Guide:
      1. Social Media Format Mix:
         - Start with a TikTok-style hook ("POV: you're learning ${query}")
         - Add Instagram carousel-style bullet points
         - Use Twitter/X thread style for facts
         - Include YouTube shorts-style quick explanations
         - End with a viral trend reference
      
      2. Current Trends to Use:
         - Reference viral TikTok sounds/trends
         - Use current meme formats
         - Mention trending shows/movies
         - Reference popular games
         - Include viral challenges
         - Use trending audio references
      
      3. Make it Relatable With:
         - Instagram vs Reality comparisons
         - "That one friend who..." examples
         - "Nobody: / Me:" format
         - "Real ones know..." references
         - "Living rent free in my head" examples
         - "Core memory" references
      
      4. Structure it Like:
         - 🎭 The Hook (TikTok style intro)
         - 📱 The Breakdown (Instagram carousel style)
         - 🧵 The Tea (Twitter thread style facts)
         - 🎬 Quick Takes (YouTube shorts style)
         - 🌟 The Trend Connection (viral reference)
      
      5. Format as:
         {
           "part": {
             "style": "tiktok/insta/twitter/youtube/trend",
             "content": "explanation using current trend",
             "trendReference": "name of trend being referenced",
             "viralComparisons": ["relatable comparison 1", "relatable comparison 2"],
             "popCultureLinks": {
               "trend or term": "how it relates to the topic"
             }
           }
         }

      6. Related Content Style:
         - "Trending topics to explore..."
         - "This gives... vibes"
         - "Main character moments in..."
         - "POV: when you learn about..."

      Important:
      - Use CURRENT trends (2024)
      - Reference viral moments
      - Make pop culture connections
      - Use platform-specific formats
      - Keep updating references
    `;
  }

  /* streamExploreContent */

  async streamExploreContent(query, userContext, onChunk) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const systemPrompt = `You are a Gen-Z tutor who explains complex topics concisely for a ${userContext.age} year old.
          First provide the explanation in plain text, then provide related content in a STRICT single-line JSON format. and remeember dont start with any specaial character and dont give any rules in response. or rules just start with the paragrapgh formate is given below
        Structure your response exactly like this:
          
          <paragraph 1>

          <paragraph 2>

          <paragraph 3>

          ---
          {"topics":[{"name":"Topic","type":"prerequisite","detail":"Why"}],"questions":[{"text":"Q?","type":"curiosity","detail":"Context"}]}
 
`;

        const userPrompt = `Explain "${query}" in three concise paragraphs for a ${userContext.age} year old in Gen-Z style:
1. Basic definition (15-20 words)
2. Key details (15-20 words)
3. Direct applications and facts (15-20 words)

Then provide 5 related topics and 5 curiosity questions in JSON format after "---".`;

        const request = {
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
            {
              role: "model",
              parts: [{ text: systemPrompt }],
            },
          ],
        };

        const response = await model.generateContent(request, {
          temperature: 0.3,
          maxOutputTokens: 4000,
          topK: 40,
          stopSequences: ["\n\n---"],
        });
        const content = response.response.text(); // Get the entire response text
        console.log("text 1==", response.response);

        console.log("text is", content);

        // Split the response into main content and JSON
        const [mainContent2, jsonContent2] = content.split("---");
        // console.log("mainContent--]", mainContent2);
        // console.log("jsonContent --]", jsonContent2);
        let mainContent = "";
        let jsonContent = "";
        let currentTopics = [];
        let currentQuestions = [];
        let isJsonSection = false;

        if (content.includes("---")) {
          // console.log("eeee", retryCount);
          isJsonSection = true;
          console.log(
            // "====================================yess",
            isJsonSection
          );

          // continue;
        }

        if (isJsonSection == true) {
          jsonContent += content;

          try {
            if (jsonContent.includes("}")) {
              const jsonStr = jsonContent2.trim();
              // console.log("now2", jsonContent2 , 'jkh', jsonContent2[0]);

              if (jsonStr.startsWith("{") && jsonStr.endsWith("}")) {
                console.log("is hereuuuuuuuuuu");

                const parsed = JSON.parse(jsonContent2);

                // Process topics if available
                if (parsed.topics && Array.isArray(parsed.topics)) {
                  parsed.topics.forEach((topic) => {
                    if (!currentTopics.some((t) => t.topic === topic.name)) {
                      currentTopics.push({
                        topic: topic.name,
                        type: topic.type,
                        reason: topic.detail,
                      });
                    }
                  });
                }
                // Process questions if available
                if (parsed.questions && Array.isArray(parsed.questions)) {
                  parsed.questions.forEach((question) => {
                    if (
                      !currentQuestions.some(
                        (q) => q.question === question.text
                      )
                    ) {
                      currentQuestions.push({
                        question: question.text,
                        type: question.type,
                        context: question.detail,
                      });
                    }
                  });
                }
                // Send update with current state
                // console.log('mainContent2', mainContent2);
                onChunk({
                  text: mainContent2.replace(/<\/?a>/g, "").trim(),
                  topics: currentTopics.length > 0 ? currentTopics : undefined,
                  questions:
                    currentQuestions.length > 0 ? currentQuestions : undefined,
                });
              } else {
                continue;
              }
            } else {
              continue;
            }
          } catch (e) {
            console.log("thi", e);
          }
        } else {
          mainContent += content;
          onChunk({
            text: mainContent2.replace(/<\/?a>/g, "").trim(),
            topics: currentTopics.length > 0 ? currentTopics : undefined,
            questions:
              currentQuestions.length > 0 ? currentQuestions : undefined,
          });
        }

        return;
      } catch (error) {
        console.log("====================================");
        console.log("eeee", retryCount);
        console.log("====================================");
        retryCount++;
        console.error(`API attempt ${retryCount} failed:`, error);
        if (retryCount === maxRetries) {
          throw new Error(
            `Failed to process content after ${maxRetries} attempts. ${error.message}`
          );
        }
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retryCount) * 1000)
        );
      }
    }
  }

  // Example usage:
}
