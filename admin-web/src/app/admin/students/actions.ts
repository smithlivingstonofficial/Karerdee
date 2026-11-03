"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createStudentAction(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const fullName = (formData.get("fullName") as string)?.trim();
    const applicationNumber = (formData.get("applicationNumber") as string)?.trim().toUpperCase();
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const departmentId = (formData.get("departmentId") as string)?.trim();

    // Student Email and Application Number are the official login credentials
    if (!fullName || !applicationNumber || !email) {
      return { error: "Student Name, Application Number, and Institutional Email are required." };
    }

    // 1. Check application number uniqueness
    const { data: existingApp } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("application_number", applicationNumber)
      .maybeSingle();

    if (existingApp) {
      return { error: `Application Number "${applicationNumber}" is already registered.` };
    }

    // 2. Check email uniqueness in students registry
    const { data: existingEmail } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingEmail) {
      return { error: `Email address "${email}" is already assigned to another candidate.` };
    }

    // 3. Automatically create Candidate Account in Supabase Auth
    // Username = Student Email, Password = Application Number
    let authUserId: string | null = null;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: applicationNumber,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        application_number: applicationNumber,
        role: "student",
      },
    });

    if (authError) {
      // If user already exists in auth.users, fetch their ID and synchronize password
      const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = usersList?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (existingUser) {
        authUserId = existingUser.id;
        await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password: applicationNumber,
          user_metadata: {
            full_name: fullName,
            application_number: applicationNumber,
            role: "student",
          },
        });
      } else {
        return { error: `Authentication account creation failed: ${authError.message}` };
      }
    } else if (authData?.user) {
      authUserId = authData.user.id;
    }

    // 4. Insert Candidate Record into public.students
    const { error: insertError } = await supabaseAdmin.from("students").insert({
      full_name: fullName,
      application_number: applicationNumber,
      roll_number: applicationNumber, // Synchronized for backwards compatibility
      email: email,
      department_id: departmentId || null,
      auth_user_id: authUserId,
      is_active: true,
    });

    if (insertError) throw insertError;

    revalidatePath("/students");
    revalidatePath("/departments");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to register candidate." };
  }
}

export async function updateStudentAction(id: string, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const fullName = (formData.get("fullName") as string)?.trim();
    const applicationNumber = (formData.get("applicationNumber") as string)?.trim().toUpperCase();
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const departmentId = (formData.get("departmentId") as string)?.trim();

    if (!fullName || !applicationNumber || !email) {
      return { error: "Student Name, Application Number, and Institutional Email are required." };
    }

    // 1. Fetch current student record
    const { data: currentStudent } = await supabaseAdmin
      .from("students")
      .select("id, auth_user_id, email, application_number")
      .eq("id", id)
      .maybeSingle();

    let authUserId = currentStudent?.auth_user_id;

    // 2. Synchronize credentials in Supabase Auth if auth_user_id exists
    if (authUserId) {
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email: email,
        password: applicationNumber,
        user_metadata: {
          full_name: fullName,
          application_number: applicationNumber,
          role: "student",
        },
      });
    } else {
      // Create auth user if missing
      const { data: newAuth } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: applicationNumber,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          application_number: applicationNumber,
          role: "student",
        },
      });
      if (newAuth?.user) {
        authUserId = newAuth.user.id;
      }
    }

    // 3. Update public.students record
    const { error } = await supabaseAdmin
      .from("students")
      .update({
        full_name: fullName,
        application_number: applicationNumber,
        roll_number: applicationNumber,
        email: email,
        department_id: departmentId || null,
        auth_user_id: authUserId,
      })
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/students");
    revalidatePath("/departments");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update candidate record." };
  }
}

export async function deleteStudentAction(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    // 1. Fetch candidate to identify their auth_user_id
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, auth_user_id")
      .eq("id", id)
      .maybeSingle();

    // 2. Delete candidate record from public.students
    const { error } = await supabaseAdmin.from("students").delete().eq("id", id);
    if (error) throw error;

    // 3. Remove corresponding login account from Supabase Auth
    if (student?.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(student.auth_user_id);
    }

    revalidatePath("/students");
    revalidatePath("/departments");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to remove student record." };
  }
}

// Emergency Invigilator Tool: Unbinds workstation hardware hash so candidate can resume on replacement PC
export async function resetHardwareBindingAction(studentId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    // 1. Reset hardware binding, unlock workstation, and clear any stale submission lock across all sessions for this candidate
    const { data: updatedSessions, error: updateError } = await supabaseAdmin
      .from("exam_sessions")
      .update({
        hardware_fingerprint: "UNBOUND_RESET_BY_ADMIN",
        status: "IN_PROGRESS",
        submitted_at: null,
      })
      .eq("student_id", studentId)
      .select("id, status, hardware_fingerprint");

    if (updateError) {
      console.error("Failed to unbind sessions:", updateError);
      return { error: updateError.message || "Failed to reset workstation hardware binding." };
    }

    // 2. Log audit event into violation_logs
    if (updatedSessions && updatedSessions.length > 0) {
      for (const sess of updatedSessions) {
        await supabaseAdmin.from("violation_logs").insert({
          session_id: sess.id,
          violation_type: "WINDOW_UNFOCUSED",
          strike_number: 0,
          metadata: {
            event_type: "WORKSTATION_UNBIND_RESET",
            reason: "Invigilator performed emergency workstation hardware unbind and workstation unlock.",
            performedBy: user.email,
            unboundAt: new Date().toISOString(),
          },
        });
      }
    }

    revalidatePath("/students");
    revalidatePath("/proctoring");
    revalidatePath("/exams");
    return { success: true, count: updatedSessions?.length || 0 };
  } catch (err: any) {
    console.error("resetHardwareBindingAction exception:", err);
    return { error: err.message || "Failed to reset workstation hardware binding." };
  }
}

export async function bulkImportStudentsAction(
  rows: {
    applicationNumber: string;
    fullName: string;
    email: string;
    departmentCode: string;
  }[]
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    if (!rows || rows.length === 0) {
      return { error: "No student records provided." };
    }

    // 1. Fetch all departments to map code -> UUID
    const { data: departments } = await supabaseAdmin.from("departments").select("id, code");
    const deptMap = new Map<string, string>();
    (departments || []).forEach((d) => deptMap.set(d.code.toUpperCase().trim(), d.id));

    // 2. Auto-create any missing departments detected in CSV
    for (const r of rows) {
      const code = r.departmentCode?.trim().toUpperCase();
      if (code && !deptMap.has(code)) {
        const { data: newDept } = await supabaseAdmin
          .from("departments")
          .insert({ name: `Department of ${code}`, code })
          .select("id, code")
          .single();
        if (newDept) {
          deptMap.set(newDept.code, newDept.id);
        }
      }
    }

    // 3. Process candidate accounts and create Auth logins
    const validRows = rows.filter(
      (r) => r.applicationNumber?.trim() && r.fullName?.trim() && r.email?.trim()
    );

    // Fetch existing candidates to preserve UUIDs and prevent conflict collisions
    const { data: existingStudents } = await supabaseAdmin
      .from("students")
      .select("id, roll_number, application_number, email");

    const studentByEmail = new Map<string, string>();
    const studentByRoll = new Map<string, string>();
    (existingStudents || []).forEach((s: any) => {
      if (s.email) studentByEmail.set(s.email.toLowerCase().trim(), s.id);
      if (s.roll_number) studentByRoll.set(s.roll_number.toUpperCase().trim(), s.id);
      if (s.application_number) studentByRoll.set(s.application_number.toUpperCase().trim(), s.id);
    });

    const payload = [];

    for (const r of validRows) {
      const appNum = r.applicationNumber.trim().toUpperCase();
      const studentEmail = r.email.trim().toLowerCase();
      const code = r.departmentCode?.trim().toUpperCase();
      const deptId = deptMap.get(code) || null;
      const existingId = studentByRoll.get(appNum) || studentByEmail.get(studentEmail);

      let authUserId: string | null = null;

      try {
        const { data: newAuth, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: studentEmail,
          password: appNum,
          email_confirm: true,
          user_metadata: {
            full_name: r.fullName.trim(),
            application_number: appNum,
            role: "student",
          },
        });

        if (!authErr && newAuth?.user) {
          authUserId = newAuth.user.id;
        } else {
          // If already exists, attempt to update password to match application number
          const { data: userSearch } = await supabaseAdmin.auth.admin.listUsers();
          const found = userSearch?.users?.find(
            (u) => u.email?.toLowerCase() === studentEmail
          );
          if (found) {
            authUserId = found.id;
            await supabaseAdmin.auth.admin.updateUserById(found.id, {
              password: appNum,
              user_metadata: {
                full_name: r.fullName.trim(),
                application_number: appNum,
                role: "student",
              },
            });
          }
        }
      } catch (authException) {
        console.warn(`Auth creation notice for ${studentEmail}:`, authException);
      }

      payload.push({
        ...(existingId ? { id: existingId } : {}),
        full_name: r.fullName.trim(),
        application_number: appNum,
        roll_number: appNum,
        email: studentEmail,
        department_id: deptId,
        auth_user_id: authUserId,
        is_active: true,
      });
    }

    // 4. Upsert candidate records into public.students using unique roll_number constraint
    const { error } = await supabaseAdmin
      .from("students")
      .upsert(payload, { onConflict: "roll_number" });

    if (error) throw error;

    revalidatePath("/students");
    revalidatePath("/departments");
    return { success: true, count: payload.length };
  } catch (err: any) {
    return { error: err.message || "Bulk student import failed." };
  }
}
