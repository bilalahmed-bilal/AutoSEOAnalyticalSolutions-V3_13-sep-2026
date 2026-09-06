export type OperatingStatus = "healthy" | "attention" | "action_required";
export interface OperatingCycle { status:OperatingStatus; score:number; summary:string; priorities:Array<{id:string;title:string;priority:string;owner:string;nextStep:string;reason:string}>; controls:string[]; evidence:string[]; }
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
export function buildOperatingCycle(input:any):OperatingCycle{
 const strategy=input.strategy||null, alerts=Number(input.alertCount||0), queue=Number(input.queueFailed||0), connections=Number(input.unhealthyConnections||0);
 const priorities:Array<any>=[]; const evidence:string[]=[];
 if(strategy?.actions?.length){for(const a of strategy.actions.slice(0,5)) priorities.push({id:`strategy-${a.id}`,title:a.title,priority:a.priority,owner:a.type==="fix"?"SEO / Technical":"SEO / Content",nextStep:a.dependencies?.[0]||"Review evidence and approve next step",reason:a.rationale}); evidence.push(`${strategy.actions.length} prioritized strategy actions`);}
 if(alerts>0){priorities.unshift({id:"monitoring-alerts",title:"Resolve active monitoring alerts",priority:alerts>=3?"critical":"high",owner:"SEO Operations",nextStep:"Inspect affected pages and compare with baseline",reason:`${alerts} active alert(s) require review.`});evidence.push(`${alerts} monitoring alert(s)`);}
 if(queue>0){priorities.unshift({id:"queue-health",title:"Clear failed publishing jobs",priority:"high",owner:"Publishing Operations",nextStep:"Review failed job attempts before retrying",reason:`${queue} failed job(s) are waiting for operational review.`});evidence.push(`${queue} failed queue job(s)`);}
 if(connections>0){priorities.unshift({id:"connections",title:"Repair unhealthy integrations",priority:"high",owner:"Workspace Admin",nextStep:"Run connection health check and reconnect if required",reason:`${connections} connection(s) report unhealthy status.`});evidence.push(`${connections} unhealthy connection(s)`);}
 const score=clamp(100-alerts*12-queue*10-connections*12-(strategy?.overallPriority==="critical"?20:strategy?.overallPriority==="high"?10:0));
 const status:OperatingStatus=score<55?"action_required":score<80?"attention":"healthy";
 const controls=["Human approval remains required before destructive or external publishing actions.","Use deterministic evidence as the source of truth; AI explanations cannot create new facts.","Prefer reversible changes, measured baselines and durable job execution.","Do not infer causality from Search Console or experiment data without controlled evidence."];
 return {status,score,summary:status==="healthy"?"Operating cycle is stable; continue monitoring and execute the highest-value approved action.":status==="attention"?"Operating cycle needs focused review before scaling work.":"Operating cycle has material operational or SEO risks that should be addressed before growth work.",priorities:priorities.slice(0,8),controls,evidence};
}
