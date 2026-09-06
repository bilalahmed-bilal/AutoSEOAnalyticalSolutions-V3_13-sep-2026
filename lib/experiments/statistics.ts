export interface ExperimentMetrics { clicks: number; impressions: number; ctr: number; averagePosition: number | null; }
export interface VariantEvaluation { variant: "a" | "b"; ctr: number; clicks: number; impressions: number; absoluteCtrLiftVsOther: number; relativeCtrLiftVsOther: number | null; significant: boolean; }

function clamp(n:number,min:number,max:number){ return Math.max(min, Math.min(max,n)); }
function normalCdf(z:number){ return 0.5 * (1 + erf(z / Math.sqrt(2))); }
function erf(x:number){ const sign=x<0?-1:1; const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911; const t=1/(1+p*Math.abs(x)); return sign*(1-(((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t)*Math.exp(-x*x)); }

/** Two-proportion z-test. CTR is treated as a binomial proportion; clicks/position remain descriptive. */
export function compareCtr(a: ExperimentMetrics, b: ExperimentMetrics, confidenceThreshold=0.95, minAbsoluteLift=0.01){
  const ai=Math.max(0,Math.floor(a.impressions)), bi=Math.max(0,Math.floor(b.impressions));
  const ac=clamp(Math.floor(a.clicks),0,ai), bc=clamp(Math.floor(b.clicks),0,bi);
  if(ai<1 || bi<1) return { pValue:null, significant:false, winner:null as "a"|"b"|null, absoluteLift:a.ctr-b.ctr };
  const p1=ac/ai,p2=bc/bi, pooled=(ac+bc)/(ai+bi), se=Math.sqrt(Math.max(1e-12,pooled*(1-pooled)*(1/ai+1/bi)));
  const z=(p1-p2)/se, p=2*(1-normalCdf(Math.abs(z))), alpha=1-confidenceThreshold;
  const lift=p1-p2;
  const significant=p<alpha && Math.abs(lift)>=minAbsoluteLift;
  return { pValue:p, significant, winner:significant?(lift>0?"a":"b"):null, absoluteLift:lift };
}

export function evaluateExperiment(a:ExperimentMetrics,b:ExperimentMetrics,opts:{confidenceThreshold?:number;minImpressions?:number;minClicks?:number;minAbsoluteCtrLift?:number}={}){
  const minImpressions=opts.minImpressions ?? 100, minClicks=opts.minClicks ?? 10, confidenceThreshold=opts.confidenceThreshold ?? 0.95, minAbsoluteCtrLift=opts.minAbsoluteCtrLift ?? 0.01;
  const enough=a.impressions>=minImpressions && b.impressions>=minImpressions && a.clicks>=minClicks && b.clicks>=minClicks;
  const test=compareCtr(a,b,confidenceThreshold,minAbsoluteCtrLift);
  const winner=enough && test.significant ? test.winner : null;
  return { status:winner ? (winner === "a" ? "winner_a" : "winner_b") : "inconclusive", winner, enoughData:enough, pValue:test.pValue, absoluteCtrLift:test.absoluteLift, a:{...a,ctr:a.impressions?a.clicks/a.impressions:0}, b:{...b,ctr:b.impressions?b.clicks/b.impressions:0}, confidenceThreshold, minAbsoluteCtrLift } as const;
}
