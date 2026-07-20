# SmartLearners.ai — Knowledge Transfer

## Overview

The system is a single FastAPI backend (`main.py`) that powers **three distinct chatbots** sharing the same infrastructure. All three use Google Gemini AI under the hood and follow the same session-based pattern.

---

## Chatbot 1 — Student Chatbot

**Who uses it:** Students (Class 6–12), via a mobile/web app.

**Session type:** `user_type = "student"`

**What it can do:**

| Feature | What it does |
|---|---|
| **Performance Analysis** | Tells the student how they did overall — scores, grades, percentages — across exams, homework, and self-practice. |
| **Strength Detection** | Identifies topics and questions where the student performed well (100% score, no errors). |
| **Weakness Detection** | Identifies where the student struggled — broken down by error type (conceptual mistake, calculation mistake, skipped, incomplete). |
| **Specific Exam Drill-down** | Student can ask about a specific exam (e.g., "SA1") and get results only for that exam. |
| **Question-wise Breakdown** | Shows performance on each individual question — what went wrong and what concepts were involved. |
| **Remedial Study Plan** | Generates a day-by-day study schedule for weak chapters, prioritized by how important the chapter is in NCERT exams and how often the student got it wrong. |
| **Tutor Mode — Solve a Problem** | The student sends a question and the bot solves it step by step, like a tutor. |
| **Tutor Mode — Check My Answer** | The student submits their own answer and the bot tells them if it's right or wrong and why. |
| **Image Support** | Student can upload a photo of a question (e.g., a handwritten problem) and ask about it. |
| **Voice Input** | Student can send an audio message — it gets transcribed and processed as a text query. |
| **Multi-language Support** | Detects and responds in English, Hindi, or Telugu. |
| **Guardrails** | Blocks off-topic questions (non-academic) and attempts to extract system instructions. |

---

## Chatbot 2 — Teacher Chatbot

**Who uses it:** Teachers, via the same app (different login role).

**Session type:** `user_type = "teacher"`

**What it can do:**

| Feature | What it does |
|---|---|
| **Class Performance Summary** | Overview of how all students in a class did on an exam — average, highest, lowest score. |
| **Top Performers** | Lists the best-scoring students in the class for any given exam. |
| **Struggling Students** | Lists students who scored below a threshold (default 50%) and what they need help with. |
| **Grade Distribution** | Shows what percentage of the class got A+, A, B+, B, C, D, F — and the class pass rate. |
| **Common Weak Areas** | Finds the topics most students struggled with, so the teacher knows what to re-teach. |
| **Specific Student Drill-down** | Teacher can ask about one student by name and get their detailed question-by-question performance. |
| **Class Comparison** | Compare performance across different class sections (e.g., 10A vs. 10B). |
| **Teaching Recommendations** | Suggests what the teacher should focus on in the next class based on class-wide weaknesses. |
| **Guardrails** | Blocks off-topic questions and prompt extraction attempts, same as student bot. |

---

## Chatbot 3 — WhatsApp Chatbot

**Who uses it:** Students (and potentially parents) on WhatsApp via Interakt.

**Session type:** Stateless — no session ID, identified by phone number.

**What it can do:**

| Feature | What it does |
|---|---|
| **Auto Student Lookup** | When a message arrives, the system looks up the student by their phone number in the database. No login required. |
| **Registration Flow** | If the phone number is not registered, sends a link to sign up for a free trial. |
| **Performance Queries** | Same analysis as the Student Chatbot — scores, weaknesses, strengths — but delivered over WhatsApp. |
| **Simple Responses** | Greetings, "who are you?", "help" — answered instantly without calling the AI. |
| **Multi-language** | Detects the language of the message and replies in the same language (English/Hindi/Telugu). |
| **WhatsApp Formatting** | Responses are formatted with WhatsApp bold (`*text*`) instead of markdown, so they display correctly in the app. |
| **Async Processing** | Returns a 200 OK to Interakt immediately, then processes and replies in the background — so WhatsApp doesn't time out. |

---

## Bonus — Test Prep Analysis

**Not a chatbot, but a dedicated endpoint:** `/test-prep-analysis`

Takes a student's MCQ exam results (with right/wrong answers), finds all wrong questions, and for each one:
- Explains the concept behind the question
- Shows exactly where the student's reasoning went wrong
- Generates 2 new practice MCQs on the same concept

This bypasses the full pipeline entirely and goes straight to Gemini with a structured output schema.
