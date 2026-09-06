import { updateDraftRemote, getDraftVersionRemote } from "@/lib/store-repository";
import { enqueueJob, experimentPublishJobKey } from "@/lib/jobs/queue";
import { getExperiment, updateExperiment } from "@/lib/experiments/repository";
import type { StoreContext } from "@/lib/store-repository";
import { normalizeSnapshot } from "@/lib/optimization/versioning";

export async function queueExperimentVariant(ctx:StoreContext, experimentId:string, variant:"a"|"b"){
  if(!ctx.workspaceId || !ctx.req) throw new Error("Workspace context required.");
  const exp=await getExperiment(ctx.workspaceId,experimentId); if(!exp) throw new Error("Experiment not found.");
  const versionId=variant==="a"?exp.variantAVersionId:exp.variantBVersionId;
  const version=await getDraftVersionRemote(ctx,versionId); if(!version || version.draftId!==exp.draftId) throw new Error("Experiment variant version does not belong to this draft.");
  const snap=normalizeSnapshot(version.optimized);
  const draft=await updateDraftRemote(ctx,exp.draftId,{title:snap.title,body:snap.body,metaDescription:snap.metaDescription,status:"approved",errorMessage:undefined});
  if(!draft) throw new Error("Draft not found.");
  const job=await enqueueJob({workspaceId:ctx.workspaceId,type:"publish_draft",payload:{draftId:exp.draftId,sourceVersionId:versionId,experimentId,experimentVariant:variant},idempotencyKey:experimentPublishJobKey(ctx.workspaceId,experimentId,variant)});
  const today=new Date().toISOString().slice(0,10);
  const patch=variant==="a"?{status:"running_a",variant_a_start:today}:{status:"running_b",variant_b_start:today};
  return {experiment:await updateExperiment(ctx.workspaceId,experimentId,patch),jobId:job?.id};
}
