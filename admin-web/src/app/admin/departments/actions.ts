"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createDepartmentAction(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim().toUpperCase();

    if (!name || !code) {
      return { error: "Department Name and Code are required." };
    }

    const { data: existing } = await supabaseAdmin
      .from("departments")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (existing) {
      return { error: `Department code "${code}" is already registered.` };
    }

    const { error } = await supabaseAdmin.from("departments").insert({
      name,
      code,
    });

    if (error) throw error;

    revalidatePath("/departments");
    revalidatePath("/students");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to create department." };
  }
}

export async function updateDepartmentAction(id: string, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim().toUpperCase();

    if (!name || !code) {
      return { error: "Department Name and Code are required." };
    }

    const { error } = await supabaseAdmin
      .from("departments")
      .update({ name, code })
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/departments");
    revalidatePath("/students");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update department." };
  }
}

export async function deleteDepartmentAction(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    // Check if students enrolled
    const { count } = await supabaseAdmin
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("department_id", id);

    if (count && count > 0) {
      return {
        error: `Cannot delete department: ${count} candidate(s) are actively enrolled in this department. Reassign or remove candidates before deleting.`,
      };
    }

    const { error } = await supabaseAdmin.from("departments").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/departments");
    revalidatePath("/students");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to delete department." };
  }
}

// 1-Click Action to populate standard Kalasalingam Academic Departments
export async function seedStandardDepartmentsAction() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    const STANDARD_DEPARTMENTS = [
      { name: "Department of Computer Applications", code: "MCA" },
      { name: "Department of Computer Science and Engineering", code: "CSE" },
      { name: "Department of Information Technology", code: "IT" },
      { name: "Department of Artificial Intelligence and Data Science", code: "AIDS" },
      { name: "Department of Electronics and Communication Engineering", code: "ECE" },
      { name: "Department of Electrical and Electronics Engineering", code: "EEE" },
      { name: "Department of Mechanical Engineering", code: "MECH" },
      { name: "Department of Civil Engineering", code: "CIVIL" },
      { name: "Department of Biotechnology", code: "BIOTECH" },
      { name: "School of Commerce and Management Studies", code: "COMMERCE" },
      { name: "Department of Mathematics", code: "MATHS" },
      { name: "Department of Physics", code: "PHYSICS" },
      { name: "Department of Chemistry", code: "CHEMISTRY" },
    ];

    // Upsert by code to avoid duplicate key errors
    const { error } = await supabaseAdmin
      .from("departments")
      .upsert(STANDARD_DEPARTMENTS, { onConflict: "code" });

    if (error) throw error;

    revalidatePath("/departments");
    revalidatePath("/students");
    return { success: true, count: STANDARD_DEPARTMENTS.length };
  } catch (err: any) {
    return { error: err.message || "Failed to seed standard departments." };
  }
}

// Bulk Import Departments via CSV
export async function bulkImportDepartmentsAction(
  rows: { name: string; code: string }[]
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized access" };

    if (!rows || rows.length === 0) {
      return { error: "No department records provided." };
    }

    const payload = rows
      .filter((r) => r.name?.trim() && r.code?.trim())
      .map((r) => ({
        name: r.name.trim(),
        code: r.code.trim().toUpperCase(),
      }));

    if (payload.length === 0) {
      return { error: "No valid rows found to import." };
    }

    const { error } = await supabaseAdmin
      .from("departments")
      .upsert(payload, { onConflict: "code" });

    if (error) throw error;

    revalidatePath("/departments");
    revalidatePath("/students");
    return { success: true, count: payload.length };
  } catch (err: any) {
    return { error: err.message || "Bulk department import failed." };
  }
}
