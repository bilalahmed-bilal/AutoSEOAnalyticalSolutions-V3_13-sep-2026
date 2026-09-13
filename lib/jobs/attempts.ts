import { supabaseAdmin } from "@/lib/db/supabase-rest";
import { type UnknownRecord } from "@/lib/unknown";

export async function startJobAttempt(jobId: string, workspaceId: string, attempt: number, workerId: string) {
  const [row] = await supabaseAdmin<UnknownRecord[]>(
    "job_attempts",
    {
      method: "POST",
      body: JSON.stringify({
        job_id: jobId,
        workspace_id: workspaceId,
        attempt,
        worker_id: workerId,
        status: "running",
      }),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    },
    "?on_conflict=job_id,attempt"
  );
  return row;
}

export async function finishJobAttempt(input: {
  jobId: string;
  attempt: number;
  status: "succeeded" | "failed";
  errorMessage?: string;
  providerJobId?: string;
  providerLink?: string;
}) {
  const rows = await supabaseAdmin<UnknownRecord[]>(
    "job_attempts",
    {
      method: "PATCH",
      body: JSON.stringify({
        status: input.status,
        finished_at: new Date().toISOString(),
        error_message: input.errorMessage?.slice(0, 2000) ?? null,
        provider_job_id: input.providerJobId ?? null,
        provider_link: input.providerLink ?? null,
      }),
      headers: { Prefer: "return=representation" },
    },
    `?job_id=eq.${encodeURIComponent(input.jobId)}&attempt=eq.${input.attempt}`
  );
  return rows[0] ?? null;
}
