# KARE-SES Sample Data Library

This directory contains standardized sample `.csv` files ready for direct bulk ingestion into the **KARE-SES (Kalasalingam Academy of Research and Education — Secure Exam Software)** platform.

---

## Root Datasets

| File | Primary Use | Where to Ingest in Admin Portal |
| :--- | :--- | :--- |
| [`departments.csv`](./departments.csv) | Master Academic Departments (13 Departments) | Admin Portal > **Departments** (`/departments`) > *Bulk Import CSV* |
| [`candidates.csv`](./candidates.csv) | Enrolled Doctoral Candidates / Students (20 Candidates) | Admin Portal > **Candidates** (`/students`) > *Bulk CSV Ingestion* |

---

## Questions Library (`sample-data/questions/`)

A comprehensive suite of Ph.D. qualifying examination question papers separated into **Common to All** and **Individual Departments**:

| File | Target Curriculum / Department | Question Count | Specialization Areas |
| :--- | :--- | :--- | :--- |
| **[`questions_common.csv`](./questions/questions_common.csv)** | **Common to All Candidates (Part A)** | **20 MCQs** | Research Methodology, Experimental Design, Hypotheses, Statistics, Data Interpretation, Ethics |
| **[`questions_mca.csv`](./questions/questions_mca.csv)** | Computer Applications (`MCA`) | **30 MCQs** | Data Structures, Algorithms, BCNF Normalization, Python Generators, REST API, Deadlocks, SOLID |
| **[`questions_cse.csv`](./questions/questions_cse.csv)** | Computer Science & Engineering (`CSE`) | **30 MCQs** | Formal Languages, LALR Parsers, Superscalar Branch Prediction, Linux Virtual Memory, CAP Theorem |
| **[`questions_it.csv`](./questions/questions_it.csv)** | Information Technology (`IT`) | **30 MCQs** | Cloud Orchestration (K8s), Microservices API Gateway, TLS 1.3 ECDHE, Apache Spark RDDs, Zero Trust |
| **[`questions_aids.csv`](./questions/questions_aids.csv)** | Artificial Intelligence & Data Science (`AIDS`) | **30 MCQs** | Deep Learning Vanishing Gradients, Transformer Self-Attention, CNN Pooling, PR-AUC, MDPs, LoRA |
| **[`questions_ece.csv`](./questions/questions_ece.csv)** | Electronics & Communication (`ECE`) | **30 MCQs** | Nyquist Sampling, CMOS Dynamic Power, 5G OFDM, BIBO Stability, SPI Bus Protocols, Smith Chart |
| **[`questions_eee.csv`](./questions/questions_eee.csv)** | Electrical & Electronics (`EEE`) | **30 MCQs** | Newton-Raphson Load Flow, VSI Conduction, Induction Motor Slip, MPPT Solar Tracking, Smart Grid |
| **[`questions_mech.csv`](./questions/questions_mech.csv)** | Mechanical Engineering (`MECH`) | **30 MCQs** | Brayton Gas Turbines, Navier-Stokes Derivations, Euler Buckling, Merchant Circle Metal Cutting |
| **[`questions_civil.csv`](./questions/questions_civil.csv)** | Civil Engineering (`CIVIL`) | **30 MCQs** | Hardy Cross Moment Distribution, Terzaghi Consolidation, Water-Cement Ratio, Froude Number, SSD |
| **[`questions_biotech.csv`](./questions/questions_biotech.csv)** | Biotechnology (`BIOTECH`) | **30 MCQs** | EcoRI Restriction Sticky Ends, TATA Box Transcription, Monod Kinetics, CRISPR-Cas9 PAM Motifs |
| **[`questions_math.csv`](./questions/questions_math.csv)** | Mathematics (`MATH`) | **30 MCQs** | Symmetric Matrix Real Eigenvalues, Heine-Borel Compactness, Lagrange Subgroups, Liouville Theorem |
| **[`questions_physics.csv`](./questions/questions_physics.csv)** | Physics (`PHYSICS`) | **30 MCQs** | Quantum Harmonic Oscillator Zero-Point Energy, BCS Superconductivity Cooper Pairs, Gluons, Relativity |
| **[`questions_chem.csv`](./questions/questions_chem.csv)** | Chemistry (`CHEM`) | **30 MCQs** | Sharpless Epoxidation, Huckel (4n+2) Aromaticity, Octahedral d6 Low-Spin CFT, Nernst Potential |
| **[`questions_mba.csv`](./questions/questions_mba.csv)** | Management Studies (`MBA`) | **30 MCQs** | Porter's Five Forces, CAPM Systematic Beta, CPM Critical Path Float, DuPont ROE Decomposition, SCM |

---

## Universal CSV Column Specification for Questions

All question CSVs use the standardized 13-column format accepted by both the **Institutional Question Bank** (`/questions`) and the **Authoring Studio Drawer** (`/exams/new`):

```csv
Department Code,Topic,Difficulty,Question Type,Question Prompt,Code Snippet,Option A,Option B,Option C,Option D,Correct Option,Points,Negative Points
```

- **`Department Code`**: `GENERAL` for Common questions, or matching departmental code (e.g. `MCA`, `CSE`, `AIDS`).
- **`Topic`**: Academic subject / module name.
- **`Difficulty`**: `EASY`, `MEDIUM`, or `HARD`.
- **`Question Type`**: `MCQ_SINGLE` (single choice) or `MCQ_MULTIPLE` (multiple choice).
- **`Question Prompt`**: The problem statement.
- **`Code Snippet`**: Optional monospace code or formula block (leave empty if not applicable).
- **`Option A` to `Option D`**: Four distinct answer options.
- **`Correct Option`**: Single letter (`A`, `B`, `C`, `D`) or comma-separated letters (`A,B,C`).
- **`Points`**: Marks awarded for correct answers (e.g. `1.0` or `2.0`).
- **`Negative Points`**: Penalty deducted for incorrect answers (e.g. `0.25` or `0.50`).

---

## How to Import

### Option 1: Institutional Question Bank (`/questions`)
1. Navigate to **Institutional Question Bank** in the left sidebar (`http://localhost:3000/questions`).
2. Click **Bulk Import CSV**.
3. Drag & drop any of the departmental CSVs (or `questions_common.csv`).
4. Click **Import Questions**.

### Option 2: Exam Authoring Studio (`/exams/new`)
1. Create or edit an examination paper.
2. In **Step 2 (Sections)**, configure:
   - **Section 1**: Common Core (`is_common = true`)
   - **Section 2**: Department Specialization (select target departments, e.g. `MCA`, `CSE`, etc.)
3. In **Step 3 (Questions)** or via the CSV Import drawer:
   - Upload `questions_common.csv` into Section 1.
   - Upload the matching department CSV into Section 2.
