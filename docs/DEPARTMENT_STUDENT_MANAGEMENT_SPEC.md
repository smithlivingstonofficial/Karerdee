# Department & Student Management Specification

This document defines the architecture, database relationships, administrative workflows, and bulk ingestion mechanisms for **Department Management** and **Student Management** in KARE-SES.

---

## 1. System Context & Relationship to Secure Examination

In KARE-SES, the candidate's **Roll Number** is the primary key entered into the Windows Lockdown Client. The system resolves:

```
Candidate inputs Roll Number (e.g. "2024-MCA-042")
       │
       ▼
Look up Student in Roster ───► Verify Active Status (is_active == true)
       │
       ▼
Resolve Assigned Batch (e.g. "MCA 2024-2026 Batch A")
       │
       ▼
Resolve Department (e.g. Department of Computer Applications, Code: "MCA")
       │
       ▼
Determine Exam Curriculum:
├── Common Core Sections (Served to all students)
└── Department-Specific Sections (Targeting code "MCA")
```

---

## 2. Department & Batch Management (`/departments`)

### 2.1 Functional Capabilities
- **Department Registry**:
  - Department Name (e.g., *"Department of Computer Applications"*).
  - Department Code (Unique uppercase shortcode: `MCA`, `CSE`, `ECE`, `IT`, `MECH`, `CIVIL`, `MATH`, `MGMT`).
  - Active counts of associated batches and enrolled students.
- **Batch Management**:
  - Each department contains one or more academic batches.
  - Batch Name (e.g., *"MCA 2024–2026"*, *"Ph.D 2026 Research Scholars"*).
  - Academic Year (e.g., `2024-2026`).
  - Enrolled candidate headcount.

### 2.2 UI Structure:
- **Left/Top**: Department summary grid showing department cards with code badges and student headcounts.
- **Detailed View**: Clicking a department displays its batches, courses, and student roster.
- **Actions**:
  - `+ Add Department` modal.
  - `+ Add Batch` modal.
  - Edit and Delete safeguards (cannot delete department if active exams or students are enrolled).

---

## 3. Student / Candidate Registry (`/students`)

### 3.1 Functional Capabilities
- **Candidate Attributes**:
  - `Roll Number` (Unique institutional roll number, e.g., `24MCA001`).
  - `Full Name`.
  - `Institutional Email` (e.g., `student@kalasalingam.ac.in`).
  - `Department` & `Batch` selection.
  - `Account Status` (`Active` / `Suspended`).
- **Hardware Binding & Reset Protocol**:
  - When a student authenticates on a physical laptop in an exam, their session locks to that machine's CPU and motherboard hash.
  - If a student's laptop suffers hardware failure or crashes during an exam, the invigilator needs an immediate action: **`Reset Workstation Binding`**.
  - This clears the stored hardware fingerprint, allowing the student to log in on a backup lab computer.
- **Interactive Search & Filtering**:
  - Filter by Department (All, MCA, CSE, ECE, etc.).
  - Filter by Batch.
  - Instant live search by Roll Number or Student Name.

---

## 4. Bulk CSV / Excel Student Ingestion

Universities enroll hundreds of students at a time. The system provides an automated **Bulk Student Roster Importer**.

### 4.1 Standardized CSV Format
```csv
Roll Number,Full Name,Email,Department Code,Batch Name,Academic Year
24MCA001,Aravind Kumar,aravind@kalasalingam.ac.in,MCA,MCA 2024-2026,2024-2026
24MCA002,Bhavani Shankar,bhavani@kalasalingam.ac.in,MCA,MCA 2024-2026,2024-2026
24CSE015,Deepak Raj,deepak@kalasalingam.ac.in,CSE,CSE 2024-2028,2024-2028
24ECE042,Divya Lakshmi,divya@kalasalingam.ac.in,ECE,ECE 2024-2028,2024-2028
```

### 4.2 Ingestion Engine Workflow:
1. **Validation**: Checks for required columns, validates roll number uniqueness, and verifies email formats.
2. **Auto-Resolution**:
   - If Department Code (e.g. `MCA`) exists, maps to it; if not, creates the department automatically.
   - If Batch Name exists under that department, attaches to it; if not, creates the batch automatically.
3. **Upsert Transaction**: Efficiently upserts students into `students` table.
4. **Summary Report**: Shows count of new students enrolled, updated records, and any malformed rows skipped.

---

## 5. Implementation Roadmap & Milestones

- [ ] **Milestone 1: Server Actions & Database Operations (`actions.ts`)**:
  - `createDepartment`, `deleteDepartment`, `createBatch`, `deleteBatch`.
  - `createStudent`, `updateStudent`, `deleteStudent`, `resetStudentHardware`.
  - `bulkImportStudentsCsv`.
- [ ] **Milestone 2: Department Management UI (`/departments/page.tsx`)**:
  - Departments table/cards with batch breakdown.
  - Modal to create departments and batches.
- [ ] **Milestone 3: Student Management UI (`/students/page.tsx`)**:
  - Searchable, filterable student roster table.
  - Hardware binding status pill with 1-click **Reset Workstation** action.
  - Manual Student Registration modal.
- [ ] **Milestone 4: Bulk Student Importer UI**:
  - Download sample student CSV template.
  - Drag-and-drop CSV upload with live preview table before committing to the database.
- [ ] **Milestone 5: Sidebar Navigation Update**:
  - Update `Sidebar.tsx` routes to `/departments` and `/students`.

