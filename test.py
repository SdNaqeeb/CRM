import requests
from collections import defaultdict

API_URL     = "https://crmapi.smartlearners.ai/api/external-data/test-prep/by-school-code"
SCHOOL_CODE = "ELP"
LIMIT       = 100

print("Fetching data...")
resp = requests.post(API_URL, json={"school_code": SCHOOL_CODE, "limit": LIMIT})
resp.raise_for_status()
items = resp.json().get("items", [])
print(f"Total fetched: {len(items)}")

# Filter class 10, section A
filtered = [
    item for item in items
    if str(item.get("class_name", "")).strip() == "10"
    and str(item.get("section_name", "")).strip().upper() == "A"
]
print(f"Class 10 Section A items: {len(filtered)}")

# Get unique students sorted alphabetically, pick first 5
students = {}
for item in filtered:
    name = item.get("student_name", "")
    if name and name not in students:
        students[name] = item.get("username", "")

top5 = sorted(students.keys())[:5]
print(f"\nFirst 5 students (alphabetically): {top5}")

# ── RAW DATA ─────────────────────────────────────────────────────────────────
print("\n=== RAW DATA ===")
print(f"{'name':<25} {'section':<10} {'class':<8} {'subject':<20} {'score':<10} {'time':<10}")
print("-" * 85)
for item in sorted(filtered, key=lambda x: (x.get("student_name",""), x.get("created_at",""))):
    if item.get("student_name") in top5:
        gd = item.get("graph_data") or {}
        print(
            f"{str(item.get('student_name','')):<25} "
            f"{str(item.get('section_name','')):<10} "
            f"{str(item.get('class_name','')):<8} "
            f"{str(gd.get('subject','')):<20} "
            f"{str(gd.get('score_pct','')):<10} "
            f"{str(gd.get('time_spent_sec','')):<10}"
        )

# ── STUDENT IMPROVEMENT ───────────────────────────────────────────────────────
# Group attempts by (student_name, subject), sorted by created_at
grouped = defaultdict(list)
for item in filtered:
    if item.get("student_name") not in top5:
        continue
    gd = item.get("graph_data") or {}
    subject = gd.get("subject", "Unknown")
    grouped[(item.get("student_name",""), subject)].append({
        "section":   item.get("section_name", ""),
        "score":     gd.get("score_pct"),
        "time":      gd.get("time_spent_sec"),
        "created_at": item.get("created_at", ""),
    })

# Sort each group chronologically
for key in grouped:
    grouped[key].sort(key=lambda x: x["created_at"])

print("\n=== STUDENT IMPROVEMENT ===")
print(f"{'student_name':<25} {'section':<10} {'subject':<20} {'attempts':<10} {'1st score%':<12} {'best score%':<12} {'1st time(s)':<13} {'best time(s)':<12}")
print("-" * 115)

for (name, subject), attempts in sorted(grouped.items()):
    scores = [a["score"] for a in attempts if a["score"] is not None]
    times  = [a["time"]  for a in attempts if a["time"]  is not None]

    first_score = attempts[0]["score"]
    first_time  = attempts[0]["time"]
    best_score  = max(scores) if scores else None
    best_time   = min(times)  if times  else None
    section     = attempts[0]["section"]

    print(
        f"{name:<25} "
        f"{section:<10} "
        f"{subject:<20} "
        f"{len(attempts):<10} "
        f"{str(first_score):<12} "
        f"{str(best_score):<12} "
        f"{str(first_time):<13} "
        f"{str(best_time):<12}"
    )
