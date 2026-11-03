# Exam Authoring Studio Specification — Multi-Department MCQ Architecture

This document defines the functional design, multi-department routing, CSV import structure, and UI flow for the **Exam Authoring Studio** in the Safe Exam Platform.

---

## 1. Core Principles

1. **Pure MCQ Focus**: The platform is dedicated exclusively to **Multiple Choice Questions** (Single-Select and Multi-Select). Auto-grading is 100% instant and deterministic upon candidate submission.
2. **Optional Negative Marking**: Negative marking is a configurable toggle at the exam level (`enable_negative_marking: true/false`). If disabled, incorrect answers receive 0 penalty.
3. **Modular Multi-Department Sections**:
   - **Common Section (Core)**: Taken by all candidates across every participating department (e.g., General Research Methodology, Logical Reasoning).
   - **Department-Specific Sections**: Assigned to specific department codes (e.g., MCA, CSE, ECE).
4. **Zero-Friction Candidate Routing**:
   - The instructor generates a **single universal Exam Passcode**.
   - When a student inputs their Roll Number in the Windows Lockdown Client, the system checks their enrolled department in the institutional roster and automatically serves the **Common Section + their assigned Department Section**.
   - Questions outside the student's department are stripped from their manifest.
5. **Dual Authoring Workflow**:
   - **Interactive Visual Studio**: Drag-and-drop section creation, intuitive MCQ editor with live stat counters.
   - **Bulk CSV / Excel Importer**: Download a standardized spreadsheet template, populate questions in Excel, and import hundreds of questions in one click.

---

## 2. Multi-Department Data Hierarchy

```
Exam: "Ph.D Entrance Qualifying Examination 2026"
├── Passcode: "PHD2026"
├── Negative Marking: Optional (Enabled: -0.25 per wrong answer)
├── Randomize Order: Enabled (Deterministic shuffle per candidate)
│
├── Section 1: "Part A — Research Aptitude & Quantitative Logic"
│   ├── Target: ALL DEPARTMENTS (Common Core)
│   ├── Total Questions: 25
│   └── Marks Per Question: 1.0 (Negative: 0.25)
│
├── Section 2: "Part B — Advanced Computer Applications & Systems"
│   ├── Target: Department of Computer Applications (MCA) & Computer Science (CSE)
│   ├── Total Questions: 50
│   └── Marks Per Question: 2.0 (Negative: 0.50)
│
└── Section 3: "Part B — Electronics & Embedded Architectures"
    ├── Target: Department of Electronics & Communication (ECE)
    ├── Total Questions: 50
    └── Marks Per Question: 2.0 (Negative: 0.50)
```

### Candidate Manifest Resolution:
- **Student A (Roll: `2026-MCA-012`, Dept: `MCA`)**:
  - Receives: **Section 1 (Common) + Section 2 (MCA)** $\to$ 75 Questions Total.
- **Student B (Roll: `2026-ECE-044`, Dept: `ECE`)**:
  - Receives: **Section 1 (Common) + Section 3 (ECE)** $\to$ 75 Questions Total.

---

## 3. Bulk CSV / Excel Import Template

Instructors can bulk-create complete multi-department exams using this clean CSV format:

```csv
Section Name,Is Common,Target Dept Code,Question Type,Prompt,Option A,Option B,Option C,Option D,Correct Option,Points,Negative Points
Part A - Research Aptitude,TRUE,,MCQ_SINGLE,"Which variable is manipulated by the researcher in an experiment?",Independent variable,Dependent variable,Extraneous variable,Confounding variable,A,1.0,0.25
Part A - Research Aptitude,TRUE,,MCQ_MULTIPLE,"Select ALL primary sources of qualitative research data:",Participant observation,In-depth interviews,Systematic literature review,Focus groups,"A,B,D",2.0,0.50
Part B - Computer Science,FALSE,MCA,"In operating systems, what condition is NOT required for deadlock?",Mutual exclusion,Hold and wait,Preemption allowed,Circular wait,C,2.0,0.50
Part B - Electronics,FALSE,ECE,"Which semiconductor material has the widest direct bandgap?",Silicon,Gallium Nitride,Germanium,Gallium Arsenide,B,2.0,0.50
```

---

## 4. Visual Studio UI Architecture

The Studio is organized into 3 intuitive tabs with a persistent **Exam Live Stat Summary Header**:

```
+----------------------------------------------------------------------------------------------------+
| EXAM AUTHORING: Ph.D Qualifying Examination 2026                     [Draft]  [Cancel] [SAVE EXAM] |
| Sections: 3 | Total Questions: 125 | Max Marks: 200 | Negative Marking: [X] Active (-0.25 / -0.50) |
+----------------------------------------------------------------------------------------------------+
| [ 1. General Setup ]  |  [ 2. Sections & Routing ]  |  [ 3. Question Builder (MCQ) ]               |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  Section Selector: [ Section 1: Common Core (25) ] [ Section 2: MCA (50) ] [+ Add Section]         |
|                                                                                                    |
|  [+ Add Single MCQ]  [+ Add Multi-Select MCQ]  [📥 Bulk CSV Import]  [📥 Download CSV Template]     |
|                                                                                                    |
|  +-----------------------------------------------------------------------------------------------+ |
|  | Q1  [MCQ_SINGLE] | Marks: [ 1.0 ] | Negative: [ 0.25 ]                         [Copy] [Delete]| |
|  |-----------------------------------------------------------------------------------------------| |
|  | Prompt: [ Which variable is manipulated directly by the experimenter in an empirical study? ] | |
|  |                                                                                               | |
|  | Options:                                                                                      | |
|  | (●) A. [ Independent Variable                                                     ] (Correct) | |
|  | (○) B. [ Dependent Variable                                                       ]           | |
|  | (○) C. [ Confounding Factor                                                       ]           | |
|  | (○) D. [ Controlled Baseline                                                      ]           | |
|  | [+ Add Option]                                                                                | |
|  +-----------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

