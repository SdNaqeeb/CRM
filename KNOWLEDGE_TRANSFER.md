# CRM Frontend — Knowledge Transfer

A plain-English guide to everything in this app: what each dashboard does, what each feature is for, and who uses it.

---

## Who Uses This App

There are three types of users, each with their own dashboard:

| Role | What they see |
|------|--------------|
| **Teacher** | Their own students and class performance |
| **School Admin** | All students and teachers in their school |
| **OrcaLex Admin** | The entire platform across all schools |

Everyone logs in from the same screen. The app automatically sends each user to the right dashboard based on their role.

---

## Login Page

The entry point for all users.

- **Role selector** — Pick whether you're logging in as a Teacher, School Admin, or OrcaLex Admin. The form adjusts based on what you pick.
- **Teachers** enter their username.
- **School Admins** enter their school code.
- **OrcaLex Admins** log in with no extra credentials (demo/internal access).

---

## Teacher Dashboard

The day-to-day control center for a teacher. Everything here is scoped to their own students.

The left side has a collapsible sidebar to switch between sections. The main area changes based on what's selected.

---

### Students

A full list of all the teacher's students.

- Each student shows their name, class, section, engagement status, last login date, and how many sessions they've had this week.
- **Engagement status** is color-coded: green = Active, amber = At Risk, red = Inactive.
- You can **filter** the list by engagement status, class, or section.
- You can **sort** by name, last login, or number of sessions.
- Clicking a student opens their **full profile** (see Student Profile below).
- You can select multiple students and **send a bulk WhatsApp alert** to all their parents at once.
- You can also **send a challenge** (a set of AI-generated practice questions) to any individual student.

---

### Track Status

Shows how students are progressing on assignments — whether they're on track or falling behind.

- Displays a bar chart broken down into three groups: **On Track**, **Slightly Off**, and **Completely Off**.
- You can filter by a specific topic or assignment.
- Click any bar to expand it and see which individual students are in that group, along with their scores for that topic.

---

### Scheduled Assignments

A calendar showing all assignments that have been given to students.

- Assignments appear on the dates they're due.
- Each card shows how many students were assigned, how many viewed it, and how many submitted.
- Clicking an assignment jumps straight to the Track Status view filtered for that topic.
- You can filter by subject or section.

---

### Daily Quizzes

A list of all homework/quiz assignments.

- Shows the title, subject, chapters covered, date assigned, due date, and how many students submitted.
- Click any quiz to see a table of which students submitted and when.

---

### Weekly Exams

A list of all exams created by the teacher.

- Shows the exam name, type, how many students it was assigned to, how many attempted it, and the class average.
- Click any exam to see a ranked list of student attempts sorted by score, with time spent and submission date.

---

### Mock Exams

Results from full mock exams (like practice board/entrance exams).

- Filter by class and section to narrow the list.
- Click any exam to see a results table with each student's score, time spent, and submission date.
- Scores are color-coded (red = low, green = high).
- You can download results as an Excel file.

---

### Mock Exam Analysis

A deeper analytical view of mock exam performance across the programme.

- **KPI cards** at the top show totals: how many exams were created, total submissions, and the weighted average score.
- Below that, a full table of every exam with detailed stats.
- You can see **score distributions** (how many students scored in each band: 0–20%, 20–40%, etc.).
- **Subject breakdown** shows performance split by Maths, Science, etc.
- **Student flags**: automatically highlights students who finished suspiciously fast with perfect scores, or students who rushed and scored very low.

---

### Compare Mock Exams

Side-by-side comparison of two mock exams.

- Select a class/section, then pick two exams to compare.
- See score distribution charts for both exams next to each other.
- See individual student score changes between the two exams — who improved, who dropped.

---

### Pre-Assessment (Spot Check)

A view of student performance on test prep / pre-assessment activities.

- Filter by chapter, class, section, minimum number of attempts, or a minimum score threshold.
- The table shows each student's number of attempts, best score, average score, and the date of their last attempt.

---

### Activity Feed

A chronological log of everything that's happened — a live timeline.

- Shows student logins, quiz attempts, exam submissions, homework completions — all in order.
- Each entry shows the student's name, what they did, the subject, their score, and the time.
- Organized by day so you can quickly scan what happened recently.

---

## Student Profile (opens from Students tab)

A detailed pop-up for any individual student.

- Basic info: name, class, section, engagement status, last login.
- Activity summary: total sessions, sessions this week, whether they're currently online.
- Recent scores from gap analysis activities and exams.
- A line graph showing their activity level over time.
- A breakdown of their test prep results by subject and chapter.

---

## School Dashboard

For school administrators. Same core features as the Teacher Dashboard but covering the **entire school** — all teachers, all classes, all students.

---

### Header Metrics

Large cards at the top showing school-wide numbers at a glance:

- Total students enrolled
- Students active this week
- Students currently in a live session
- Students at risk
- Inactive students
- Engagement trend (going up or down vs. last period)

---

### Students (School-wide)

The same student table as in the Teacher view, but showing all students across all classes and teachers.

- All the same filtering, sorting, and bulk alert features apply.

---

### Spot Check (School-wide)

Pre-assessment/test prep results for all students in the school.

- Same filters as the teacher version (chapter, class, section, score thresholds).

---

### Activity (School-wide)

The full activity feed for the entire school — every student and teacher.

---

### Timeline

Upload a teaching schedule or lesson plan in CSV format.

- Drag and drop a CSV file and the app parses it automatically.
- Displays: teacher name, week, date range, subject, topic, learning objectives, and resources.
- Helps admins track what's being taught and when.

---

### Analytics Charts

Donut charts showing the engagement split (Active / At Risk / Inactive) across the school.

- One chart per teacher or per class section.
- Lets admins quickly see which teacher's students are most/least engaged.

---

### Recent Alerts

A quick list of the most recent WhatsApp engagement alerts that were sent, with an option to resend any of them.

---

## OrcaLex Admin Dashboard

The platform-wide view for the OrcaLex team. Everything is visible here — all schools, all students, all teachers.

---

### Platform Metrics

Cards showing totals across the entire platform:

- Total schools
- Total students
- Total teachers
- Active sessions right now
- Breakdown of Active / At Risk / Inactive with percentages

---

### Students (Platform-wide)

All students across every school.

- Can filter by school or by how many days since last login.

---

### Teachers (Platform-wide)

All teachers across every school, with the same filtering options.

---

### Activity (Platform-wide)

Activity feed for any school — select a school from a dropdown to view its specific activity timeline.

---

### Analytics (Platform-wide)

Multiple donut charts — one per school — showing each school's engagement distribution.

---

### Scatter Plot

A visual chart that plots student **engagement** on one axis against **score improvement** on the other.

- Useful for spotting which schools or students are improving despite low engagement, or vice versa.

---

## Shared Features (available across dashboards)

### WhatsApp Alerts
Send a pre-written engagement alert to a student's parent via WhatsApp. Works for single students or a bulk selection.

### Send Challenge
Generate a custom set of MCQ practice questions for a student on the spot.
- Pick a subject, an optional concept, and how many questions (1–10).
- The app generates the questions using AI, shows a preview, and sends them to the student.
- Math equations are rendered properly in the preview.

### Engagement Status
Every student is automatically classified into one of three states based on their recent activity:
- **Active** — logged in and doing work recently
- **At Risk** — hasn't been active for a few days
- **Inactive** — hasn't logged in for a significant period

This classification drives the color-coding throughout the entire app.

### Help Bar
Each section has a small info strip at the top explaining what that section does and what to look for. It's context-sensitive — it changes based on which tab you're on.

---

## Quick Reference — Which Dashboard Has What

| Feature | Teacher | School Admin | OrcaLex Admin |
|---------|---------|-------------|---------------|
| Student list | Own students only | All in school | All on platform |
| Engagement status & alerts | Yes | Yes | Yes |
| Mock exam results | Yes | — | — |
| Mock exam analysis | Yes | — | — |
| Compare exams | Yes | — | — |
| Pre-assessment / Spot Check | Yes | Yes | — |
| Activity feed | Yes | Yes | Per school |
| Track status | Yes | — | — |
| Scheduled assignments | Yes | — | — |
| Daily quizzes | Yes | — | — |
| Weekly exams | Yes | — | — |
| Timeline upload | — | Yes | — |
| School-wide analytics | — | Yes | All schools |
| Platform scatter plot | — | — | Yes |
| Teacher list | — | — | Yes |
