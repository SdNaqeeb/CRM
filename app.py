from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
import os
import json
import re
import uuid
import logging
from functools import lru_cache  # kept for potential future use
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
import google.genai as genai
from google.genai import types
from langsmith import traceable
from dotenv import load_dotenv
load_dotenv()  # Load environment variables from .env file

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURATION
# ============================================================================
GOOGLE_API_KEY = "AIzaSyCgxzI--q3qlwpPkmU3Lv2v475II3yCDdM"
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

GENAI_MODEL = "gemini-2.5-flash"


def get_genai_client():
    """Create and return the google-genai client."""
    logger.debug("Creating google-genai client")
    return genai.Client(api_key=GOOGLE_API_KEY)


app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class GenerateQuestionsRequest(BaseModel):
    class_num: int = Field(..., ge=3, le=12)
    chapters: List[str] = Field(..., min_length=1)
    questions_per_chapter: int = Field(default=5, ge=1, le=15)
    subject: Literal["MATHEMATICS", "PHYSICS"] = Field(default="MATHEMATICS", description="Subject: MATHEMATICS or PHYSICS")

class StudentAnswer(BaseModel):
    question_num: int = Field(..., ge=1)
    selected_option: str = Field(..., min_length=1, max_length=1)

class BridgeScanEvaluateRequest(BaseModel):
    class_num: int = Field(..., ge=3, le=12)
    questions: List[Dict[str, Any]] = Field(..., min_length=1)
    answers: List[StudentAnswer] = Field(..., min_length=1)
    subject: Literal["MATHEMATICS", "PHYSICS"] = Field(default="MATHEMATICS", description="Subject: MATHEMATICS or PHYSICS")

class MCQOptions(BaseModel):
    """The 4 options for an MCQ."""
    A: str = Field(description="Option A text")
    B: str = Field(description="Option B text")
    C: str = Field(description="Option C text")
    D: str = Field(description="Option D text")

class GeneratedMCQ(BaseModel):
    """Structured output model for generate-questions endpoint."""
    question_num: int = Field(description="Question number")
    chapter: str = Field(description="Chapter name")
    bridge_id: str = Field(description="Bridge ID being tested e.g. B8.1.1")
    bridge_name: str = Field(description="Bridge name")
    question: str = Field(description="The question text")
    options: MCQOptions = Field(description="Four options A/B/C/D")
    correct_answer: str = Field(description="Correct option letter (A/B/C/D)")
    trap_answer: str = Field(description="Trap option letter")
    trap_explanation: str = Field(description="Why this trap fails")
    concept_tested: str = Field(description="Bridge concept being tested")

class BridgeEvaluation(BaseModel):
    """Phase 1: Evaluation of a single bridge from student's answer."""
    bridge_id: str = Field(description="Bridge ID")
    bridge_name: str = Field(description="Bridge name")
    status: str = Field(description="intact, broken, or weak")
    misconception: str = Field(description="What misconception the student has, empty if intact")
    severity: int = Field(description="1-5 severity score, 0 if intact")

class ChapterDiagnosis(BaseModel):
    """Diagnosis for a single chapter."""
    chapter: str = Field(description="Chapter name")
    score_percent: int = Field(description="Score percentage for this chapter")
    strongest_bridge: str = Field(description="Name of strongest bridge in this chapter")
    weakest_bridge: str = Field(description="Name of weakest bridge in this chapter")
    key_misconception: str = Field(description="The most critical misconception found")
    priority: str = Field(description="high, medium, or low remedial priority")

class OverallDiagnosis(BaseModel):
    """Phase 2: Overall diagnosis across all chapters."""
    chapter_diagnoses: list[ChapterDiagnosis] = Field(description="Diagnosis per chapter")
    top_3_gaps: list[str] = Field(description="Top 3 most critical gaps to fix")
    predicted_board_score: int = Field(description="Predicted board exam score out of 100")
    study_hours_needed: int = Field(description="Estimated study hours to fix all gaps")
    encouragement: str = Field(description="A brief encouraging message for the student")

class StudyPlanDay(BaseModel):
    """A single day in the day-wise remedial study plan."""
    day: int = Field(description="Day number (1, 2, 3, ...)")
    topic: str = Field(description="Topic or bridge to work on")
    chapter: str = Field(description="Chapter name")
    what_to_do: str = Field(description="Specific study actions: which NCERT exercises, examples, or practice to do")
    time_minutes: int = Field(description="Estimated time in minutes for this day's work")
    goal: str = Field(description="What the student should be able to do after this day")

class StudyPlanSummaryModel(BaseModel):
    """Phase 3: Complete day-wise remedial study plan."""
    total_days: int = Field(description="Total number of days in the plan")
    total_hours: float = Field(description="Total estimated study hours")
    plan: list[StudyPlanDay] = Field(description="Day-by-day study plan")
    expected_score_after: int = Field(description="Expected score out of 100 after completing the plan")

class PracticeMCQ(BaseModel):
    """A single bridge repair practice MCQ (structured output)."""
    question: str = Field(description="The question text")
    chapter: str = Field(description="Chapter name")
    bridge_id: str = Field(description="Bridge being repaired")
    difficulty: str = Field(description="easy or hard")
    options: MCQOptions = Field(description="Four options A/B/C/D")
    correct_answer: str = Field(description="Correct option letter")
    solution: str = Field(description="Detailed explanation of why this is the right decision")
    trap_warning: str = Field(description="Why the trap option feels right but is wrong")

class WorkedExample(BaseModel):
    level: str = Field(description="'basic' or 'board_exam'")
    problem: str = Field(description="The problem statement")
    solution: str = Field(description="Complete step-by-step solution")

class FoundationRepairItem(BaseModel):
    concept_id: str = Field(description="Concept ID e.g. C8.1.1")
    concept_name: str = Field(description="Name of the foundation concept")
    concept_class: int = Field(description="Class level of this concept")
    chapter: str = Field(description="Chapter name")
    concept_explanation: str = Field(description="What it is, formal definition, and why it matters")
    ncert_reference: str = Field(description="Exact textbook, chapter name, section")
    key_formulas: List[str] = Field(description="Every formula/identity/theorem for this concept")
    worked_example: str = Field(description="One problem solved step-by-step showing the concept")
    practice_exercises: List[str] = Field(description="3 specific exercise numbers from NCERT textbook")
    self_check: str = Field(description="One question the student should answer after studying")

class BridgeRepairItem(BaseModel):
    bridge_id: str = Field(description="Bridge ID e.g. B10.11.1")
    bridge_name: str = Field(description="Name of the bridge")
    chapter: str = Field(description="Chapter name")
    what_went_wrong: str = Field(description="The specific misconception")
    correct_concept: str = Field(description="Clear explanation of the right way to think about it")
    ncert_reference: str = Field(description="Exact textbook chapter, section number, page range")
    key_formulas_rules: List[str] = Field(description="Every relevant formula, identity, or rule")
    worked_examples: List[WorkedExample] = Field(description="2 worked examples: 1 basic, 1 board exam level")
    practice_exercises: List[str] = Field(description="4-5 specific NCERT exercise numbers")
    common_traps: List[str] = Field(description="What mistakes to watch for")
    estimated_time_minutes: int = Field(description="How long to study this topic in minutes")

class StudyPlanSummary(BaseModel):
    total_study_time: str = Field(description="Total estimated study time")
    priority_order: List[str] = Field(description="Which gaps to fix first and why, in order")
    expected_improvement: str = Field(description="Expected score improvement if all gaps are fixed")

class RemedialPlanResponse(BaseModel):
    foundation_repairs: List[FoundationRepairItem] = Field(default=[], description="Foundation repairs")
    bridge_repairs: List[BridgeRepairItem] = Field(description="Bridge repairs for broken bridges")
    study_plan_summary: StudyPlanSummary = Field(description="Overall study plan summary")

class BridgeRepairRequest(BaseModel):
    class_num: int = Field(..., ge=3, le=12)
    chapters: List[str] = Field(..., min_length=1)
    bridge_ids: List[str] = Field(..., min_length=1, description="Broken/weak bridge IDs from evaluate response")
    subject: Literal["MATHEMATICS", "PHYSICS"] = Field(default="MATHEMATICS", description="Subject: MATHEMATICS or PHYSICS")

class CheatsheetRequest(BaseModel):
    class_num: int = Field(..., ge=3, le=12)
    chapters: List[str] = Field(..., min_length=1, description="One or more chapter names")
    subject: Literal["MATHEMATICS", "PHYSICS"] = Field(default="MATHEMATICS", description="Subject: MATHEMATICS or PHYSICS")


# ============================================================================
# BRIDGE SCAN — Data Loading & Helpers
# ============================================================================

_DATA_DIR = Path(__file__).parent

# Per-subject file paths
DATA_FILES = {
    "PHYSICS": {
        "bridges": str(_DATA_DIR / "pbt_bridge_catalogue.json"),
        "concepts": str(_DATA_DIR / "concept_foundation_catalogue.json"),
        "revision": str(_DATA_DIR / "revision_sheets.json"),
    },
    "MATHEMATICS": {
        "bridges": str(_DATA_DIR / "maths_pbt_bridge_catalogue.json"),
        "concepts": str(_DATA_DIR / "maths_concept_foundation_catalogue.json"),
        "revision": str(_DATA_DIR / "maths_revision_sheets.json"),
    },
}

# In-memory cache keyed by (subject, file_type)
_data_cache: Dict[str, Any] = {}


def _load_json_file(file_path: str) -> Dict[str, Any]:
    """Load and parse a JSON file, raising HTTPException if not found."""
    if not Path(file_path).exists():
        logger.error("File not found: %s", file_path)
        raise HTTPException(status_code=500, detail=f"{file_path} not found")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.loads(f.read())


def load_bridge_data(subject: str = "PHYSICS") -> List[Dict[str, Any]]:
    cache_key = f"bridges_{subject}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]
    file_path = DATA_FILES[subject]["bridges"]
    logger.info("Loading bridge catalogue from %s (subject=%s)", file_path, subject)
    data = _load_json_file(file_path)
    bridges = data.get("bridges", data if isinstance(data, list) else [])
    logger.info("Loaded %d bridges (subject=%s)", len(bridges), subject)
    _data_cache[cache_key] = bridges
    return bridges


def load_concept_data(subject: str = "PHYSICS") -> List[Dict[str, Any]]:
    cache_key = f"concepts_{subject}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]
    file_path = DATA_FILES[subject]["concepts"]
    logger.info("Loading concept catalogue from %s (subject=%s)", file_path, subject)
    data = _load_json_file(file_path)
    concepts = data.get("concepts", data if isinstance(data, list) else [])
    logger.info("Loaded %d concepts (subject=%s)", len(concepts), subject)
    _data_cache[cache_key] = concepts
    return concepts


def get_bridges_for_chapters(bridges: List[Dict[str, Any]], class_num: int, chapters: List[str]) -> List[Dict[str, Any]]:
    return [b for b in bridges if b.get("class") == class_num and b.get("chapter") in chapters]

def get_available_classes(bridges: List[Dict[str, Any]]) -> List[int]:
    return sorted({int(b.get("class")) for b in bridges if isinstance(b.get("class"), int)})

def get_chapters_for_class(bridges: List[Dict[str, Any]], class_num: int) -> List[str]:
    return sorted({str(b.get("chapter")) for b in bridges if b.get("class") == class_num and b.get("chapter")})


# ============================================================================
# GENERATE QUESTIONS — google-genai structured output
# ============================================================================
@traceable(run_type="llm")
def generate_mcqs(bridges_for_test: List[Dict[str, Any]], class_num: int, chapters: List[str], questions_per_chapter: int, subject: str = "MATHEMATICS") -> List[Dict[str, Any]]:
    """Generate MCQs using google-genai structured output with GeneratedMCQ model."""
    logger.info("Generating MCQs: class=%d, chapters=%s, per_chapter=%d, bridges=%d, subject=%s",
                class_num, chapters, questions_per_chapter, len(bridges_for_test), subject)
    client = get_genai_client()

    bridge_details = ""
    for b in bridges_for_test:
        bridge_details += f"\nBridge {b['id']} - {b['name']}\n  Chapter: {b['chapter']}\n  Description: {b.get('description', '')}\n  Common Errors: {b.get('common_errors', '')}\n  Difficulty: {b.get('difficulty', 3)}/5\n---"

    if subject == "PHYSICS":
        prompt = f"""You are an expert CBSE Physics diagnostic engine for Class {class_num}.

TASK: Generate exactly {len(chapters) * questions_per_chapter} DECISION-POINT MCQs - {questions_per_chapter} per chapter for: {', '.join(chapters)}.

CRITICAL: These are NOT traditional "solve and pick the answer" MCQs.
These test the student's THINKING DECISIONS — the critical choice points inside problem-solving.
Students should answer in 15-30 seconds using ONLY their brain. NO pen, NO paper, NO calculation.

QUESTION TYPES TO USE (mix these):

TYPE 1 — STRATEGY SELECTION: "What is the BEST first step?"
  Example: A block slides down a frictionless incline. The best approach to find acceleration is:
  A) Use F=ma with FBD  B) Use energy conservation  C) Use kinematics directly  D) Use momentum
  (Tests: Can the student CHOOSE the right method?)

TYPE 2 — PROBLEM RECOGNITION: "What type of problem is this?"
  Example: An object is placed between F and 2F of a convex lens. The image is:
  A) Real, inverted, diminished  B) Real, inverted, magnified  C) Virtual, erect, magnified  D) At infinity
  (Tests: Can the student RECOGNIZE the efficient approach?)

TYPE 3 — TRAP DETECTION: "What's wrong with this reasoning?"
  Example: A student writes $\sin\theta = \frac{{3}}{{5}}$, so $\cos\theta = \frac{{4}}{{5}}$. This is:
  A) Always correct  B) Only if $\theta$ is acute  C) Only in Q1 and Q4  D) Never correct
  (Tests: Can the student SPOT the hidden assumption?)

TYPE 4 — NEXT MOVE: "You're stuck here — what unlocks the next step?"
  Example: After drawing the FBD for a block on an incline, the next step has a "1". What identity unlocks it?
  A) $\\sin^2 + \\cos^2 = 1$  B) $\\sec^2 - \\tan^2 = 1$  C) $1 + \\cot^2 = \\cosec^2$  D) None
  (Tests: Can the student IDENTIFY which identity to apply?)

TYPE 5 — SEQUENCING: "Which triangle do you solve FIRST and why?"
  Example: Two-angle height problem — solve the depression triangle first because:
  A) It's easier  B) It gives horizontal distance needed for the other  C) Order doesn't matter  D) Solve simultaneously
  (Tests: Can the student SEQUENCE their problem-solving steps?)

Each question MUST target a specific thinking bridge from the list below.

BRIDGES TO TEST:
{bridge_details}

For each question provide:
- question_num: sequential number starting from 1
- chapter: the chapter name
- bridge_id: the bridge ID (e.g. B8.1.1)
- bridge_name: the bridge name
- question: the question text
- options: four options A, B, C, D
- correct_answer: the correct option letter
- trap_answer: the most tempting wrong option letter
- trap_explanation: why this trap fails
- concept_tested: the bridge concept being tested

RULES:
- EVERY question must be answerable in 15-30 seconds WITHOUT calculation
- Options should be APPROACHES/DECISIONS/JUDGMENTS — not numerical answers
- The trap_answer must reflect a real, common wrong THINKING PATTERN (not a calculation error)
- Use KaTeX LaTeX with single $ delimiters for math. Use single backslash for commands: $F = ma$, $v = u + at$, $\\frac{{1}}{{v}} + \\frac{{1}}{{u}} = \\frac{{1}}{{f}}$, $\\sin\\theta$, $\\cos\\theta$
- Mix question types across the questions"""
        system_instruction_1 = "You are a CBSE Physics diagnostic engine that tests THINKING DECISIONS, not computation. Your MCQs never require pen-and-paper solving. They test whether students can identify the right approach, spot traps, and sequence their thinking."
        system_instruction_2 = "Generate CBSE Physics decision-point MCQs as structured output."
    else:
        prompt = f"""You are an expert CBSE Mathematics exam question creator for Class {class_num}.

TASK: Generate exactly {len(chapters) * questions_per_chapter} multiple-choice questions (MCQs) - {questions_per_chapter} per chapter for: {', '.join(chapters)}.

Each question MUST target a specific thinking bridge from the list below.

BRIDGES TO TEST:
{bridge_details}

For each question provide:
- question_num: sequential number starting from 1
- chapter: the chapter name
- bridge_id: the bridge ID (e.g. B8.1.1)
- bridge_name: the bridge name
- question: the question text
- options: four options A, B, C, D
- correct_answer: the correct option letter
- trap_answer: the most tempting wrong option letter
- trap_explanation: why this trap fails
- concept_tested: the bridge concept being tested
- Use KaTeX LaTeX with single $ delimiters for math. Use single backslash for commands: $a^2 + b^2 = c^2$, $\frac{1}{2}$, $\sin\theta$, $\cos\theta$


"""
        system_instruction_1 = "You are an expert CBSE Mathematics exam question creator. Generate high-quality MCQs targeting specific thinking bridges."
        system_instruction_2 = "Generate CBSE Mathematics MCQs as structured output."

    try:
        response = client.models.generate_content(
            model=GENAI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction_1,
                temperature=0.7,
                max_output_tokens=8000,
                response_mime_type="application/json",
                response_schema=list[GeneratedMCQ],
            ),
        )
        parsed = response.parsed
        if parsed:
            logger.info("MCQ generation succeeded: %d questions generated", len(parsed))
            return [mcq.model_dump() for mcq in parsed]
        logger.warning("MCQ generation attempt 1 returned empty response")
    except Exception as e:
        logger.error("MCQ generation attempt 1 failed: %s", e, exc_info=True)

    # Retry once
    logger.info("Retrying MCQ generation (attempt 2)")
    try:
        response = client.models.generate_content(
            model=GENAI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction_2,
                temperature=0.7,
                max_output_tokens=8000,
                response_mime_type="application/json",
                response_schema=list[GeneratedMCQ],
            ),
        )
        parsed = response.parsed
        if parsed:
            logger.info("MCQ generation attempt 2 succeeded: %d questions", len(parsed))
            return [mcq.model_dump() for mcq in parsed]
        logger.warning("MCQ generation attempt 2 returned empty response")
    except Exception as e2:
        logger.error("MCQ generation attempt 2 failed: %s", e2, exc_info=True)

    logger.error("MCQ generation failed after 2 attempts")
    raise HTTPException(status_code=502, detail="LLM failed to generate questions")


# ============================================================================
# MULTI-PHASE EVALUATION ENGINE — google-genai structured outputs
# ============================================================================

@traceable(run_type="llm")
def analyze_results(questions: List[Dict[str, Any]], student_answers: Dict[int, str]) -> Dict[str, Any]:
    """Phase 0: LOCAL deterministic scoring — compare answers, classify bridge status."""
    logger.info("Phase 0: Scoring %d questions locally", len(questions))
    total = len(questions)
    correct = 0
    bridge_results: List[Dict[str, Any]] = []
    chapter_scores: Dict[str, Dict[str, int]] = {}

    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            continue
        student_ans = student_answers.get(i, "").upper()
        is_correct = student_ans == str(q.get("correct_answer", "")).upper()
        hit_trap = student_ans == str(q.get("trap_answer", "")).upper()

        if is_correct:
            correct += 1
            status = "intact"
        elif hit_trap:
            status = "broken"
        else:
            status = "weak"

        bridge_results.append({
            "bridge_id": q.get("bridge_id", f"Q{i+1}"),
            "bridge_name": q.get("bridge_name", q.get("concept_tested", "")),
            "chapter": q.get("chapter", ""),
            "status": status,
            "question_num": i + 1,
            "student_answer": student_ans,
            "correct_answer": q.get("correct_answer", ""),
            "trap_answer": q.get("trap_answer", ""),
            "trap_explanation": q.get("trap_explanation", ""),
            "questions_correct": 1 if is_correct else 0,
            "questions_total": 1,
        })

        ch = q.get("chapter", "Unknown")
        if ch not in chapter_scores:
            chapter_scores[ch] = {"correct": 0, "total": 0}
        chapter_scores[ch]["total"] += 1
        if is_correct:
            chapter_scores[ch]["correct"] += 1

    score_pct = round((correct / total) * 100, 1) if total else 0.0
    predicted_marks = round(score_pct * 0.8, 0)

    logger.info("Phase 0 result: %d/%d correct (%.1f%%), predicted marks: %.0f",
                correct, total, score_pct, predicted_marks)
    return {
        "total": total,
        "correct": correct,
        "score_pct": score_pct,
        "predicted_marks": predicted_marks,
        "bridge_results": bridge_results,
        "chapter_scores": chapter_scores,
    }


@traceable(run_type="llm")
def evaluate_phase1_bridge_status(
    questions: List[Dict[str, Any]], student_answers: Dict[int, str], class_num: int, subject: str = "MATHEMATICS"
) -> list[BridgeEvaluation]:
    """
    PHASE 1: Per-bridge AI evaluation — identifies specific misconception
    for each wrong answer using google-genai structured output.
    """
    logger.info("Phase 1: Evaluating bridge misconceptions for class %d (%d questions), subject=%s",
                class_num, len(questions), subject)
    client = get_genai_client()
    subject_label = "Physics" if subject == "PHYSICS" else "Mathematics"

    wrong_items = []
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            continue
        student_ans = student_answers.get(i, "")
        correct_ans = str(q.get("correct_answer", "")).upper()
        if student_ans.upper() == correct_ans:
            continue
        hit_trap = student_ans.upper() == str(q.get("trap_answer", "")).upper()
        opts = q.get("options", {})
        wrong_items.append({
            "bridge_id": q.get("bridge_id", f"Q{i+1}"),
            "bridge_name": q.get("bridge_name", q.get("concept_tested", "")),
            "question": q.get("question", "")[:200],
            "correct_answer": f"{correct_ans}) {opts.get(correct_ans, '')}",
            "student_answer": f"{student_ans}) {opts.get(student_ans, '')}",
            "hit_trap": hit_trap,
            "trap_explanation": q.get("trap_explanation", ""),
        })

    if not wrong_items:
        logger.info("Phase 1: All answers correct, no misconceptions to evaluate")
        return []

    logger.info("Phase 1: Found %d wrong answers to evaluate", len(wrong_items))
    prompt = f"""You are a CBSE Class {class_num} {subject_label} diagnostic expert.

A student got the following questions WRONG in a thinking-decision diagnostic test.
For each wrong answer, evaluate the bridge status and identify the specific misconception.

WRONG ANSWERS:
{json.dumps(wrong_items, indent=2)}

For each wrong answer, provide:
- bridge_id: the bridge ID
- bridge_name: the bridge name
- status: "broken" if they fell for the trap (fundamental misconception), "weak" if wrong but not the trap
- misconception: Specific description of what the student thinks incorrectly
- severity: 1-5 score (5 = most severe, will lose most marks)"""

    try:
        response = client.models.generate_content(
            model=GENAI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=f"You are a precise {subject_label} diagnostic engine. Evaluate student misconceptions based on their wrong answers.",
                temperature=0.3,
                max_output_tokens=4000,
                response_mime_type="application/json",
                response_schema=list[BridgeEvaluation],
            ),
        )
        result = response.parsed or []
        logger.info("Phase 1 completed: %d bridge evaluations returned", len(result))
        return result
    except Exception as e:
        logger.error("Phase 1 evaluation error: %s", e, exc_info=True)
        return []


@traceable(run_type="llm")
def evaluate_phase2_chapter_diagnosis(
    questions: List[Dict[str, Any]], student_answers: Dict[int, str],
    analysis: Dict[str, Any], class_num: int, subject: str = "MATHEMATICS"
) -> Optional[OverallDiagnosis]:
    """
    PHASE 2: Chapter-level AI diagnosis — synthesizes per-chapter insights,
    predicts board score, estimates study hours using google-genai structured output.
    """
    logger.info("Phase 2: Running chapter-level diagnosis for class %d, subject=%s", class_num, subject)
    client = get_genai_client()
    subject_label = "Physics" if subject == "PHYSICS" else "Mathematics"

    chapter_summary = []
    for ch, scores in analysis["chapter_scores"].items():
        ch_bridges = [br for br in analysis["bridge_results"] if br["chapter"] == ch]
        broken_names = [br["bridge_name"] for br in ch_bridges if br["status"] in ("broken", "weak")]
        intact_names = [br["bridge_name"] for br in ch_bridges if br["status"] == "intact"]
        chapter_summary.append({
            "chapter": ch, "correct": scores["correct"], "total": scores["total"],
            "broken_bridges": broken_names, "intact_bridges": intact_names,
        })

    prompt = f"""You are a CBSE Class {class_num} {subject_label} diagnostic expert.

A student completed a Bridge Scan diagnostic. Here are the results by chapter:

{json.dumps(chapter_summary, indent=2)}

Overall: {analysis['correct']}/{analysis['total']} correct ({analysis['score_pct']}%)

Provide a comprehensive diagnosis:
1. For each chapter, identify the key misconception, strongest/weakest bridge, and priority level
2. List the top 3 most critical gaps to fix (across all chapters)
3. Predict the board exam score (out of 100) based on these thinking patterns
4. Estimate study hours needed to fix all gaps
5. Write an encouraging message for the student"""

    try:
        response = client.models.generate_content(
            model=GENAI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=f"You are a caring, expert CBSE {subject_label.lower()} diagnostic engine. Be specific about misconceptions and practical about remediation.",
                temperature=0.4,
                max_output_tokens=4000,
                response_mime_type="application/json",
                response_schema=OverallDiagnosis,
            ),
        )
        logger.info("Phase 2 completed successfully")
        return response.parsed
    except Exception as e:
        logger.error("Phase 2 diagnosis error: %s", e, exc_info=True)
        return None

@traceable(run_type="llm")
def generate_study_plan_phase3(analysis: Dict[str, Any], class_num: int, subject: str = "MATHEMATICS") -> Optional[StudyPlanSummaryModel]:
    """
    PHASE 3: Day-wise remedial study plan using google-genai structured output.
    """
    logger.info("Phase 3: Generating day-wise study plan for class %d, subject=%s", class_num, subject)
    client = get_genai_client()
    subject_label = "Physics" if subject == "PHYSICS" else "Mathematics"

    bridge_info = ""
    for br in analysis.get("bridge_results", []):
        if br["status"] in ("broken", "weak"):
            severity = br.get("ai_severity", 3)
            misconception = br.get("ai_misconception", br.get("trap_explanation", ""))
            bridge_info += f"- {br['bridge_id']}: {br['bridge_name']} ({br['chapter']}) — severity {severity}/5\n"
            bridge_info += f"  Misconception: {misconception}\n"

    prompt = f"""You are a CBSE Class {class_num} {subject_label} study planner.

A student just completed a Bridge Scan diagnostic with these results:
- Score: {analysis.get('score_pct', 0)}% ({analysis.get('correct', 0)}/{analysis.get('total', 0)})
- Broken/Weak bridges:
{bridge_info}

Create a DAY-WISE REMEDIAL STUDY PLAN:

RULES:
- Each day should focus on 1-2 bridges maximum (don't overwhelm)
- Fix the highest-severity bridges FIRST (they cost the most marks)
- Include SPECIFIC actions: exact NCERT exercise numbers, example numbers, page references
- Keep each day's work to 30-90 minutes (realistic for a student)
- The goal for each day should be measurable ("can solve Exercise 4.2 Q3-Q7 without errors")
- Plan should cover ALL broken/weak bridges
- Last 1-2 days should be mixed revision + a self-test
- Be specific: "Read NCERT Example 5 (pg 82), then solve Exercise 4.2: Q3, Q5, Q7" NOT "revise chapter 4"
"""

    try:
        response = client.models.generate_content(
            model=GENAI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=f"You are a precise CBSE {subject_label} study planner. Create actionable day-wise plans with exact NCERT references.",
                temperature=0.4,
                max_output_tokens=4000,
                response_mime_type="application/json",
                response_schema=StudyPlanSummaryModel,
            ),
        )
        logger.info("Phase 3 completed successfully")
        return response.parsed
    except Exception as e:
        logger.error("Phase 3 study plan error: %s", e, exc_info=True)
        return None

@traceable(run_type="llm")
def generate_remedial_plan_structured(
    broken_bridges: List[Dict[str, Any]], cracked_foundations: List[Dict[str, Any]],
    class_num: int, questions: List[Dict[str, Any]], answers: Dict[int, str],
    analysis: Dict[str, Any], subject: str = "MATHEMATICS",
) -> Dict[str, Any]:
    """
    Generate a COMPREHENSIVE remedial plan using google-genai structured output.
    Returns a RemedialPlanResponse dict matching the existing output contract.
    """
    logger.info("Generating remedial plan: class=%d, broken_bridges=%d, cracked_foundations=%d, subject=%s",
                class_num, len(broken_bridges), len(cracked_foundations), subject)
    client = get_genai_client()
    subject_label = "Physics" if subject == "PHYSICS" else "Mathematics"

    wrong_answer_details = ""
    for br in analysis.get("bridge_results", []):
        if br.get("status") in ("broken", "weak"):
            qnum = int(br.get("question_num", 0)) - 1
            if 0 <= qnum < len(questions):
                q = questions[qnum]
                opts = q.get("options", {})
                student_ans = answers.get(qnum, "?")
                correct_ans = q.get("correct_answer", "?")
                wrong_answer_details += f"\n  WRONG ANSWER on Q{qnum + 1}:\n    Question: {q.get('question', '')[:150]}\n    Student picked: {student_ans}) {opts.get(student_ans, '')}\n    Correct was: {correct_ans}) {opts.get(correct_ans, '')}\n    Trap explanation: {br.get('trap_explanation', '')}\n"

    foundation_info = ""
    if cracked_foundations:
        foundation_info = "\n\nFOUNDATION GAPS (from earlier classes — fix FIRST):\n"
        for c in cracked_foundations:
            cid = c.get('concept_id', c.get('id', '?'))
            cname = c.get('concept_name', c.get('name', '?'))
            cclass = c.get('class', '?')
            cchapter = c.get('chapter', '?')
            foundation_info += f"- {cid}: {cname} (Class {cclass}, {cchapter})\n"

    bridge_info = ""
    for b in broken_bridges:
        bridge_info += f"\n- Bridge {b.get('id', '?')}: {b.get('name', '?')} (Class {b.get('class', class_num)}, {b.get('chapter', '')})\n  Description: {b.get('description', '')}\n  Common Error: {b.get('common_errors', '')}\n  Prerequisites: {', '.join(b.get('prerequisites', []))}\n"

    if subject == "PHYSICS":
        prompt = f"""You are a CBSE Class {class_num} Physics expert tutor creating a COMPLETE REMEDIAL STUDY GUIDE.

A student took a diagnostic test and has these gaps:
{foundation_info}

BROKEN THINKING BRIDGES:
{bridge_info}

WHAT THE STUDENT GOT WRONG:
{wrong_answer_details if wrong_answer_details else 'Details not available — generate based on bridge descriptions.'}

═══════════════════════════════════════════
GENERATE A COMPREHENSIVE REMEDIAL GUIDE with ALL of the following for EACH gap:
═══════════════════════════════════════════

{'## PART A: FOUNDATION REPAIRS (Earlier Class Concepts)' if cracked_foundations else ''}
{'For EACH foundation gap:' if cracked_foundations else ''}
{'1. CONCEPT: What it is, formal definition, and why it matters' if cracked_foundations else ''}
{'2. NCERT REFERENCE: Exact textbook, chapter name, section' if cracked_foundations else ''}
{'3. KEY FORMULAS: Every formula/identity/theorem for this concept' if cracked_foundations else ''}
{'4. WORKED EXAMPLE: Solve one problem step-by-step showing the concept' if cracked_foundations else ''}
{'5. PRACTICE EXERCISES: List 3 specific exercise numbers from NCERT textbook' if cracked_foundations else ''}
{'6. SELF-CHECK: One question the student should be able to answer after studying' if cracked_foundations else ''}

## {'PART B' if cracked_foundations else 'PART A'}: BRIDGE REPAIRS (Current Syllabus)
For EACH broken bridge:
1. WHAT WENT WRONG: Explain the specific misconception (use the student's wrong answer)
2. THE CORRECT CONCEPT: Clear explanation of the right way to think about it
3. NCERT REFERENCE: Exact textbook chapter, section number, page range
4. KEY FORMULAS/RULES: Every relevant formula, identity, or rule — written out completely
5. WORKED EXAMPLES: Solve 2 problems step-by-step:
   - Example 1: Basic level (builds understanding)
   - Example 2: Board exam level (builds confidence)
6. PRACTICE EXERCISES: List 4-5 specific exercise numbers from NCERT textbook
   (e.g., "Exercise 4.2: Q3, Q5, Q7" or "Example 8, Page 92")
7. COMMON TRAPS TO AVOID: What mistakes to watch for
8. ESTIMATED TIME: How long to study this topic (in minutes)

## STUDY PLAN SUMMARY
- Total estimated study time
- Priority order (which gaps to fix first and why)
- Expected score improvement if all gaps are fixed

CRITICAL RULES:
- Be SPECIFIC — give actual formulas, actual NCERT exercise numbers, actual worked solutions
- Do NOT be vague — "revise chapter 4" is USELESS. "Exercise 4.2, Q3-Q7, focus on discriminant" is USEFUL
- Write out formulas fully (e.g., "Quadratic Formula: x = (-b +/- sqrt(b^2-4ac)) / 2a")
- Worked examples must show EVERY step, not just the answer
- This guide should be PRINTABLE and SELF-SUFFICIENT — the student should be able to study from this alone
- Minimum 150 words per bridge gap
- Use LaTeX $ notation for ALL formulas: $F = ma$, $v = u + at$, $\\frac{{1}}{{v}} + \\frac{{1}}{{u}} = \\frac{{1}}{{f}}$, $V = IR$, $P = \\frac{{W}}{{t}}$"""
        system_instruction_1 = "You are a master CBSE Physics tutor. Your remedial guides are famous for being comprehensive, specific, and actionable. You always include exact NCERT references, complete formulas, and step-by-step worked examples. Never give vague advice."
        system_instruction_2 = "You are a master CBSE Physics tutor. Generate a comprehensive remedial study guide."
    else:
        prompt = f"""You are a CBSE Class {class_num} Mathematics expert tutor creating a COMPLETE REMEDIAL STUDY GUIDE.

A student took a diagnostic test and has these gaps:
{foundation_info}

BROKEN THINKING BRIDGES:
{bridge_info}

WHAT THE STUDENT GOT WRONG:
{wrong_answer_details if wrong_answer_details else 'Details not available — generate based on bridge descriptions.'}

═══════════════════════════════════════════
GENERATE A COMPREHENSIVE REMEDIAL GUIDE:
═══════════════════════════════════════════

{'PART A — FOUNDATION REPAIRS:' if cracked_foundations else ''}
{'For EACH foundation gap provide concept_explanation, ncert_reference, key_formulas, worked_example, practice_exercises, self_check' if cracked_foundations else ''}

{'PART B' if cracked_foundations else 'PART A'} — BRIDGE REPAIRS:
For EACH broken bridge provide:
1. what_went_wrong: The specific misconception
2. correct_concept: Clear explanation of the right way to think
3. ncert_reference: Exact textbook chapter, section, page range
4. key_formulas_rules: Every relevant formula/identity/rule
5. worked_examples: 2 problems step-by-step (basic + board exam level)
6. practice_exercises: 4-5 specific NCERT exercise numbers
7. common_traps: What mistakes to watch for
8. estimated_time_minutes: How long to study this topic

STUDY PLAN SUMMARY:
- total_study_time, priority_order, expected_improvement

CRITICAL RULES:
- Be SPECIFIC — actual formulas, actual NCERT exercise numbers
- Write out formulas fully
- Worked examples must show EVERY step
- Minimum 150 words per bridge gap
- Use Katex based LaTeX $$ delimiters for math equations



"""
        system_instruction_1 = "You are a master CBSE Mathematics tutor. Your remedial guides are famous for being comprehensive, specific, and actionable. Always include exact NCERT references, complete formulas, and step-by-step worked examples."
        system_instruction_2 = "You are a master CBSE Mathematics tutor. Generate a comprehensive remedial study guide."

    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction_1,
                temperature=1.0,
                max_output_tokens=16000,
                response_mime_type="application/json",
                response_schema=RemedialPlanResponse,
                thinking_config=types.ThinkingConfig(thinking_level="low"),
            ),
        )
        if response.parsed:
            logger.info("Remedial plan generated successfully (attempt 1)")
            return response.parsed.model_dump()
        logger.warning("Remedial plan attempt 1 returned empty response")
    except Exception as e:
        logger.error("Remedial plan attempt 1 failed: %s", e, exc_info=True)

    # Retry once
    logger.info("Retrying remedial plan generation (attempt 2)")
    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction_2,
                temperature=1.0,
                max_output_tokens=16000,
                response_mime_type="application/json",
                response_schema=RemedialPlanResponse,
                thinking_config=types.ThinkingConfig(thinking_level="low"),
            ),
        )
        if response.parsed:
            logger.info("Remedial plan generated successfully (attempt 2)")
            return response.parsed.model_dump()
        logger.warning("Remedial plan attempt 2 returned empty response")
    except Exception as e2:
        logger.error("Remedial plan attempt 2 failed: %s", e2, exc_info=True)

    logger.error("Remedial plan generation failed after 2 attempts, returning fallback")
    return RemedialPlanResponse(
        foundation_repairs=[],
        bridge_repairs=[],
        study_plan_summary=StudyPlanSummary(
            total_study_time="Error generating plan",
            priority_order=["Please retry the evaluation"],
            expected_improvement="Unknown"
        ),
    ).model_dump()


# ============================================================================
# HELPER — Root Cause Tracing, Graph Data, Enrichment
# ============================================================================

# @traceable(run_type="llm")
def trace_root_causes(broken_bridge_ids: List[str], bridges: List[Dict[str, Any]], concepts: List[Dict[str, Any]]) -> Dict[str, Any]:
    concept_lookup = {c["id"]: c for c in concepts if "id" in c}
    bridge_lookup = {b["id"]: b for b in bridges if "id" in b}
    at_risk_concept_ids = set()
    dependency_map: Dict[str, List[str]] = {}

    for bid in broken_bridge_ids:
        bridge = bridge_lookup.get(bid)
        if not bridge:
            continue
        bridge_chapter = bridge.get("chapter", "")
        bridge_class = bridge.get("class", 0)
        prereqs = bridge.get("prerequisites", [])
        concept_prereqs = [p for p in prereqs if isinstance(p, str) and p.startswith("C")]
        validated = []
        for cid in concept_prereqs:
            concept = concept_lookup.get(cid)
            if not concept:
                continue
            if concept.get("chapter", "") == bridge_chapter or concept.get("class", 99) < bridge_class:
                validated.append(cid)
        dependency_map[bid] = validated
        at_risk_concept_ids.update(validated)

    cascade_map: Dict[str, List[str]] = {}
    for cid in at_risk_concept_ids:
        affected = [bid for bid in broken_bridge_ids if cid in dependency_map.get(bid, [])]
        if affected:
            cascade_map[cid] = affected

    at_risk_concepts = [concept_lookup[cid] for cid in at_risk_concept_ids if cid in concept_lookup]
    at_risk_concepts.sort(key=lambda c: (c.get("class", 99), c.get("chapter_num", 99)))
    return {"at_risk_concepts": at_risk_concepts, "dependency_map": dependency_map, "cascade_map": cascade_map}


# @traceable(run_type="llm")
def build_graph_data(analysis: Dict[str, Any], root_cause_data: Dict[str, Any]) -> Dict[str, Any]:
    chapter_breakdown = []
    for chapter, stats in analysis.get("chapter_scores", {}).items():
        total = stats.get("total", 0)
        correct = stats.get("correct", 0)
        pct = round((correct / total) * 100, 1) if total else 0.0
        chapter_breakdown.append({
            "chapter": chapter,
            "correct": correct,
            "total": total,
            "score_pct": pct,
        })
    return {
        "chapter_breakdown": chapter_breakdown,
        "score_trend_seed": [{"attempt": 1, "score_pct": analysis.get("score_pct", 0), "predicted_marks": analysis.get("predicted_marks", 0)}],
    }


# @traceable(run_type="llm")
# def enrich_bridge_results(bridge_results: List[Dict[str, Any]], bridge_lookup: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
#     enriched = []
#     for br in bridge_results:
#         bid = br.get("bridge_id")
#         catalog = bridge_lookup.get(bid, {})
#         merged = dict(br)
#         merged["bridge_name"] = catalog.get("name", br.get("bridge_name", ""))
#         merged["description"] = catalog.get("description", "")
#         merged["common_errors"] = catalog.get("common_errors", "")
#         merged["example"] = catalog.get("example", catalog.get("trap_pattern", ""))
#         merged["tip"] = catalog.get("tip", "")
#         merged["chapter"] = catalog.get("chapter", br.get("chapter", ""))
#         merged["class"] = catalog.get("class", None)
#         enriched.append(merged)
#     return enriched


# @traceable(run_type="llm")
def slim_concept(concept: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": concept.get("id", ""), "name": concept.get("name", ""), "class": concept.get("class", None), "chapter": concept.get("chapter", ""), "chapter_num": concept.get("chapter_num", None), "type": concept.get("type", ""), "statement": concept.get("statement", ""), "example": concept.get("example", ""), "tip": concept.get("tip", "")}


def _practice_mcq_to_dict(mcq: PracticeMCQ) -> dict:
    """Convert a PracticeMCQ Pydantic model to dict matching existing output format."""
    return {
        "question": mcq.question,
        "chapter": mcq.chapter,
        "bridge_id": mcq.bridge_id,
        "difficulty": mcq.difficulty,
        "options": {"A": mcq.options.A, "B": mcq.options.B, "C": mcq.options.C, "D": mcq.options.D},
        "correct_answer": mcq.correct_answer,
        "solution": mcq.solution,
        "trap_warning": mcq.trap_warning,
    }


# ============================================================================
# BRIDGE REPAIR MCQ GENERATION — google-genai structured output
# ============================================================================

def generate_bridge_repair_mcqs_genai(
    broken_bridge_objs: List[Dict[str, Any]], class_num: int, chapters: List[str], subject: str = "MATHEMATICS"
) -> List[Dict[str, Any]]:
    """
    Generate BRIDGE REPAIR practice MCQs using google-genai structured output.
    Each question teaches the correct thinking pattern for broken bridges.
    """
    logger.info("Generating bridge repair MCQs: class=%d, chapters=%s, broken_bridges=%d, subject=%s",
                class_num, chapters, len(broken_bridge_objs), subject)
    client = get_genai_client()
    subject_label = "Physics" if subject == "PHYSICS" else "Mathematics"

    bridge_info = ""
    for b in broken_bridge_objs:
        bridge_info += f"  - {b.get('id', '?')}: {b.get('name', '?')} ({b.get('chapter', '')})\n"
        bridge_info += f"    Error pattern: {b.get('common_errors', 'N/A')}\n"
        bridge_info += f"    Description: {b.get('description', '')}\n"

    num_practice = min(len(broken_bridge_objs) * 2, 15)

    prompt = f"""You are a Class {class_num} CBSE {subject_label} thinking coach.

A student's Bridge Scan revealed these BROKEN thinking bridges:
{bridge_info}

Generate exactly {num_practice} BRIDGE REPAIR MCQs to fix these broken thinking patterns.

CRITICAL: These are DECISION-POINT questions, NOT computation questions.
Each tests a thinking DECISION the student needs to master. No pen/paper needed.
But each MUST include a detailed explanation teaching the correct thinking.

QUESTION TYPES (mix these):
- Strategy Selection: "What approach works best here?"
- Trap Detection: "What's wrong with this reasoning?"
- Next Move: "You're stuck at this step — what unlocks it?"
- Problem Recognition: "What type of problem is this?"

For each broken bridge, generate 2 practice MCQs:
  1. An EASY one where the right decision is more obvious
  2. A HARDER one where the trap is more tempting

RULES:
- EVERY question answerable in 15-30 seconds, NO calculation
- Options are DECISIONS/APPROACHES, not numerical answers
- Solutions must TEACH the thinking pattern
- Use LaTeX $ notation for math"""

    try:
        response = client.models.generate_content(
            model=GENAI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=f"You are a CBSE {subject_label} thinking coach. Create decision-point questions that teach correct thinking patterns. No computation required.",
                temperature=0.7,
                max_output_tokens=8000,
                response_mime_type="application/json",
                response_schema=list[PracticeMCQ],
            ),
        )
        parsed: list[PracticeMCQ] = response.parsed
        if parsed:
            logger.info("Bridge repair MCQs generated: %d questions (attempt 1)", len(parsed))
            return [_practice_mcq_to_dict(q) for q in parsed]
        logger.warning("Bridge repair attempt 1 returned empty response")
    except Exception as e:
        logger.error("Bridge repair generation failed (attempt 1): %s", e, exc_info=True)

    # Retry once
    logger.info("Retrying bridge repair MCQ generation (attempt 2)")
    try:
        response = client.models.generate_content(
            model=GENAI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=f"You are a CBSE {subject_label} thinking coach. Generate bridge repair practice MCQs.",
                temperature=0.7,
                max_output_tokens=8000,
                response_mime_type="application/json",
                response_schema=list[PracticeMCQ],
            ),
        )
        parsed = response.parsed
        if parsed:
            logger.info("Bridge repair MCQs generated: %d questions (attempt 2)", len(parsed))
            return [_practice_mcq_to_dict(q) for q in parsed]
        logger.warning("Bridge repair attempt 2 returned empty response")
    except Exception as e2:
        logger.error("Bridge repair generation failed (attempt 2): %s", e2, exc_info=True)

    logger.error("Bridge repair MCQ generation failed after 2 attempts")
    return []


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/health")
def health_check():
    logger.debug("Health check called")
    return {"status": "Exam mode server working ok"}


@app.get("/api/v1/classes")
def list_classes(subject: str = "PHYSICS") -> Dict[str, Any]:
    subject = subject.upper()
    if subject not in DATA_FILES:
        raise HTTPException(status_code=400, detail=f"Invalid subject: {subject}. Must be MATHEMATICS or PHYSICS")
    logger.info("GET /api/v1/classes (subject=%s)", subject)
    bridges = load_bridge_data(subject)
    classes = get_available_classes(bridges)
    logger.info("Returning %d classes", len(classes))
    return {"classes": classes}

@app.get("/api/v1/classes/{class_num}/chapters")
def list_chapters_for_class(class_num: int, subject: str = "PHYSICS") -> Dict[str, Any]:
    subject = subject.upper()
    if subject not in DATA_FILES:
        raise HTTPException(status_code=400, detail=f"Invalid subject: {subject}. Must be MATHEMATICS or PHYSICS")
    logger.info("GET /api/v1/classes/%d/chapters (subject=%s)", class_num, subject)
    if class_num < 3 or class_num > 12:
        raise HTTPException(status_code=400, detail="class_num must be between 3 and 12")
    bridges = load_bridge_data(subject)
    chapters = get_chapters_for_class(bridges, class_num)
    if not chapters:
        logger.warning("No chapters found for class %d (subject=%s)", class_num, subject)
        raise HTTPException(status_code=404, detail="No chapters found for the selected class")
    logger.info("Returning %d chapters for class %d", len(chapters), class_num)
    return {"class_num": class_num, "chapters": chapters}

@app.post("/api/v1/generate-questions")
async def bridge_scan_generate_questions(payload: GenerateQuestionsRequest) -> Dict[str, Any]:
    logger.info("POST /api/v1/generate-questions — class=%d, chapters=%s, per_chapter=%d, subject=%s",
                payload.class_num, payload.chapters, payload.questions_per_chapter, payload.subject)
    bridges = load_bridge_data(payload.subject)
    selected = get_bridges_for_chapters(bridges, payload.class_num, payload.chapters)

    if not selected:
        logger.warning("No bridges found for class=%d, chapters=%s", payload.class_num, payload.chapters)
        raise HTTPException(status_code=404, detail="No bridges found for selected class/chapters")
    logger.info("Found %d bridges, generating MCQs", len(selected))
    questions = generate_mcqs(bridges_for_test=selected, class_num=payload.class_num, chapters=payload.chapters, questions_per_chapter=payload.questions_per_chapter, subject=payload.subject)
    test_id = str(uuid.uuid4())
    logger.info("Generated %d questions, test_id=%s", len(questions), test_id)
    return {"test_id": test_id, "class_num": payload.class_num, "chapters": payload.chapters, "questions_per_chapter": payload.questions_per_chapter, "total_questions": len(questions), "questions": questions}


# ── /api/evaluate-exam/ — Multi-phase Bridge Scan evaluation ──

@app.post("/api/evaluate-exam/")
async def evaluate_exam(payload: BridgeScanEvaluateRequest) -> Dict[str, Any]:
    """
    Multi-phase Bridge Scan evaluation:
      Phase 0: Local deterministic scoring
      Phase 1: AI per-bridge misconception analysis (google-genai structured)
      Phase 2: AI chapter-level diagnosis (google-genai structured)
      Phase 3: AI day-wise study plan (google-genai structured)
      + Remedial plan (google-genai structured)
    """
    logger.info("POST /api/evaluate-exam/ — class=%d, questions=%d, answers=%d, subject=%s",
                payload.class_num, len(payload.questions), len(payload.answers), payload.subject)
    answers_map = {answer.question_num - 1: answer.selected_option.upper() for answer in payload.answers}

    # ── Phase 0: Local scoring ──
    analysis = analyze_results(payload.questions, answers_map)

    bridges = load_bridge_data(payload.subject)
    concepts = load_concept_data(payload.subject)

    broken_ids = [br["bridge_id"] for br in analysis.get("bridge_results", []) if br.get("status") in ("broken", "weak")]
    logger.info("Found %d broken/weak bridges: %s", len(broken_ids), broken_ids)
    bridge_lookup = {b.get("id"): b for b in bridges if b.get("id")}

    # ── Non-LLM: Root cause tracing + graph data (always runs) ──
    root_cause_data = trace_root_causes(broken_ids, bridges, concepts) if broken_ids else {"at_risk_concepts": [], "dependency_map": {}, "cascade_map": {}}
    broken_bridge_objs = [b for b in bridges if b.get("id") in broken_ids]

    graph_data = build_graph_data(analysis, root_cause_data)
    graph_data["subject"] = payload.subject
    prediction = {
        "score_pct": analysis.get("score_pct", 0),
        "predicted_marks_out_of_100": analysis.get("predicted_marks", 0),
        "correct": analysis.get("correct", 0),
        "total": analysis.get("total", 0),
    }

    # ── LLM Phase 1: AI misconception analysis (safe) ──
    ai_bridge_evals = []
    if broken_ids:
        try:
            ai_bridge_evals = evaluate_phase1_bridge_status(payload.questions, answers_map, payload.class_num, subject=payload.subject)
            eval_lookup = {e.bridge_id: e for e in ai_bridge_evals}
            for br in analysis["bridge_results"]:
                ai_eval = eval_lookup.get(br["bridge_id"])
                if ai_eval:
                    br["ai_misconception"] = ai_eval.misconception
                    br["ai_severity"] = ai_eval.severity
        except Exception as e:
            logger.error("Phase 1 failed (non-fatal): %s", e, exc_info=True)

    # ── LLM Phase 2: Chapter-level diagnosis (safe) ──
    overall_diagnosis = None
    if broken_ids:
        try:
            overall_diagnosis = evaluate_phase2_chapter_diagnosis(payload.questions, answers_map, analysis, payload.class_num, subject=payload.subject)
        except Exception as e:
            logger.error("Phase 2 failed (non-fatal): %s", e, exc_info=True)

    # ── LLM: Remedial plan (safe) ──
    remedial_plan = None
    if broken_bridge_objs:
        try:
            at_risk = root_cause_data.get("at_risk_concepts", [])
            remedial_plan = generate_remedial_plan_structured(
                broken_bridges=broken_bridge_objs, cracked_foundations=at_risk,
                class_num=payload.class_num, questions=payload.questions,
                answers=answers_map, analysis=analysis, subject=payload.subject,
            )
        except Exception as e:
            logger.error("Remedial plan failed (non-fatal): %s", e, exc_info=True)

    # ── Strip internal keys before sending response ──
    analysis.pop("bridge_results", None)
    analysis.pop("chapter_scores", None)

    # ── Build response (non-LLM parts always present) ──
    response = {
        "prediction": prediction,
        "analysis": analysis,
        "graph_data": graph_data,
    }

    # ── Attach LLM results only if they succeeded ──
    if remedial_plan:
        response["remedial_plan"] = remedial_plan
    if ai_bridge_evals:
        response["ai_bridge_evaluations"] = [e.model_dump() for e in ai_bridge_evals]
    if overall_diagnosis:
        response["overall_diagnosis"] = overall_diagnosis.model_dump()

    logger.info("POST /api/evaluate-exam/ completed — score=%.1f%%", analysis.get("score_pct", 0))
    return response


# ── /api/generate-learning-path — Bridge Repair practice MCQs ──

@app.post("/api/generate-learning-path")
async def generate_learning_path(payload: BridgeRepairRequest) -> Dict[str, Any]:
    """
    Bridge Repair Arena — Generate decision-point practice MCQs
    targeting the student's broken/weak thinking bridges.
    Uses google-genai structured output with PracticeMCQ model.
    """
    logger.info("POST /api/generate-learning-path — class=%d, chapters=%s, bridge_ids=%s, subject=%s",
                payload.class_num, payload.chapters, payload.bridge_ids, payload.subject)
    bridges = load_bridge_data(payload.subject)
    broken_bridge_objs = [b for b in bridges if b.get("id") in payload.bridge_ids]
    if not broken_bridge_objs:
        logger.warning("No bridges found for IDs: %s", payload.bridge_ids)
        raise HTTPException(status_code=404, detail=f"No bridges found for IDs: {payload.bridge_ids}")

    logger.info("Matched %d bridges from catalogue, generating repair MCQs", len(broken_bridge_objs))
    questions = generate_bridge_repair_mcqs_genai(
        broken_bridge_objs=broken_bridge_objs, class_num=payload.class_num, chapters=payload.chapters, subject=payload.subject,
    )
    if not questions:
        logger.error("Bridge repair MCQ generation returned empty result")
        raise HTTPException(status_code=502, detail="Failed to generate bridge repair questions. Please retry.")

    logger.info("POST /api/generate-learning-path completed — %d questions generated", len(questions))
    return {
        "class_num": payload.class_num,
        "chapters": payload.chapters,
        "target_bridges": payload.bridge_ids,
        "total_questions": len(questions),
        "questions": questions,
    }


# ============================================================================
# CHEATSHEET — /api/v1/fetch-cheatsheet
# ============================================================================

def load_revision_sheets(subject: str = "PHYSICS") -> Dict[str, Any]:
    cache_key = f"revision_{subject}"
    if cache_key in _data_cache:
        return _data_cache[cache_key]
    file_path = DATA_FILES[subject]["revision"]
    logger.info("Loading revision sheets from %s (subject=%s)", file_path, subject)
    data = _load_json_file(file_path)
    sheets = data.get("sheets", {})
    logger.info("Loaded %d revision sheets (subject=%s)", len(sheets), subject)
    _data_cache[cache_key] = sheets
    return sheets

@app.post("/api/v1/fetch-cheatsheet")
def fetch_cheatsheet(payload: CheatsheetRequest) -> Dict[str, Any]:
    logger.info("POST /api/v1/fetch-cheatsheet — class=%d, chapters=%s, subject=%s", payload.class_num, payload.chapters, payload.subject)
    sheets = load_revision_sheets(payload.subject)
    chapters_lower = [ch.strip().lower() for ch in payload.chapters]
    matched = []
    for key, sheet in sheets.items():
        if sheet.get("class") == payload.class_num and sheet.get("chapter", "").strip().lower() in chapters_lower:
            matched.append(sheet)
    if not matched:
        logger.warning("No cheatsheets found for class=%d, chapters=%s", payload.class_num, payload.chapters)
        raise HTTPException(status_code=404, detail=f"No cheatsheets found for Class {payload.class_num} with chapters: {payload.chapters}")
    logger.info("Returning %d cheatsheets", len(matched))
    return {"class_num": payload.class_num, "chapters_requested": payload.chapters, "total_sheets": len(matched), "sheets": matched}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)