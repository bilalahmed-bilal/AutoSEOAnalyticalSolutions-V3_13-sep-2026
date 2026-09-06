export type QualitySeverity = "high" | "medium" | "low";
export type QualityCategory = "seo" | "readability" | "structure" | "factual-risk" | "originality" | "trust";

export interface QualityIssue { category: QualityCategory; severity: QualitySeverity; issue: string; fix: string; evidence?: string; }
export interface QualityReport {
  score: number;
  verdict: "publish-ready" | "needs-review" | "needs-rework";
  metrics: { words: number; sentences: number; avgWordsPerSentence: number; headings: number; links: number; keywordOccurrences: number; keywordDensity: number; riskClaims: number; duplicateSimilarity: number; };
  issues: QualityIssue[];
  strengths: string[];
  factualReview: { status: "low-risk" | "review-needed" | "high-risk"; claims: string[]; note: string };
}

const STOP = new Set("a an and are as at be by for from has have how i if in into is it its of on or our that the their this to was we what when where which with you your official best top number price cost guarantee guaranteed free only fastest cheapest proven results review reviews rating ratings certified certification award awards %.".split(/\s+/));
const CLAIM_PATTERNS = [
  /\b(guarantee|guaranteed|#1|number one|best|cheapest|fastest|official|certified|award[- ]winning|proven|100%|always|never)\b/gi,
  /\b\$\s?\d[\d,.]*|\b(?:Rs\.?|PKR)\s?\d[\d,.]*/gi,
  /\b\d+(?:\.\d+)?\s?(?:%|percent|million|billion|thousand)\b/gi,
  /\b\d{1,2}(?:\/|-)\d{1,2}(?:\/|-)\d{2,4}\b/g,
];
function clean(s:string){return s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu," ").replace(/\s+/g," ").trim();}
function words(s:string){return clean(s).split(/\s+/).filter(Boolean);}
function sentences(s:string){return s.split(/[.!?]+/).map(x=>x.trim()).filter(Boolean);}
function extractHeadings(body:string){return body.split(/\n+/).filter(l=>/^#{1,6}\s+|^<h[1-6][^>]*>/i.test(l.trim())).length;}
function extractLinks(body:string){return (body.match(/https?:\/\/[^\s)]+/gi)||[]).length;}
function keywordCount(text:string, keyword:string){const k=clean(keyword); if(!k)return 0; const t=clean(text); return t.includes(k)? t.split(k).length-1 : 0;}
function similarity(a:string,b:string){const A=new Set(words(a).filter(x=>x.length>2&&!STOP.has(x))); const B=new Set(words(b).filter(x=>x.length>2&&!STOP.has(x))); if(!A.size||!B.size)return 0; let inter=0; for(const x of A)if(B.has(x))inter++; return inter/(A.size+B.size-inter);}

export function evaluateContent(input:{title?:string;body:string;metaDescription?:string;keyword?:string;language?:string;channel?:string;referenceTexts?:string[];businessFacts?:string[]}):QualityReport{
  const title=input.title||""; const body=input.body||""; const meta=input.metaDescription||""; const all=`${title}\n${body}\n${meta}`;
  const ws=words(body), ss=sentences(body), avg=ss.length?ws.length/ss.length:0; const headings=extractHeadings(body); const links=extractLinks(body);
  const kw=keywordCount(all,input.keyword||""); const density=ws.length&&input.keyword?kw/ws.length*100:0;
  const claims:string[]=[]; for(const re of CLAIM_PATTERNS){const m=all.match(re)||[]; for(const x of m)if(!claims.includes(x))claims.push(x);}
  const duplicateSimilarity=Math.max(0,...(input.referenceTexts||[]).map(x=>similarity(body,x)));
  const issues:QualityIssue[]=[]; const strengths:string[]=[]; let score=100;
  if(!title.trim()){issues.push({category:"seo",severity:"high",issue:"Missing title.",fix:"Add a clear, descriptive title aligned with the primary topic."});score-=12;} else if(title.length>65){issues.push({category:"seo",severity:"medium",issue:"Title is longer than typical search-result display length.",fix:"Tighten the title to roughly 50–65 characters without losing the main topic."});score-=5;} else strengths.push("Title is present and reasonably concise.");
  if(input.channel!=="youtube"&&input.channel!=="facebook"&&!meta.trim()){issues.push({category:"seo",severity:"medium",issue:"Missing meta description for website content.",fix:"Write a unique, benefit-led meta description around 120–160 characters."});score-=7;}
  if(ws.length<250){issues.push({category:"structure",severity:"medium",issue:"Content is quite short for a substantial SEO page.",fix:"Expand useful coverage where the topic genuinely requires more depth; do not pad with filler."});score-=6;} else strengths.push("Content has a substantial word count.");
  if(headings===0&&ws.length>350){issues.push({category:"structure",severity:"medium",issue:"Long content has no detectable headings.",fix:"Break major sections into descriptive H2/H3 headings."});score-=7;} else if(headings>0)strengths.push("Section structure is detectable.");
  if(avg>28){issues.push({category:"readability",severity:"medium",issue:`Average sentence length is high (${avg.toFixed(1)} words).`,fix:"Split long sentences and prefer direct, readable phrasing."});score-=6;} else if(avg>0)strengths.push("Sentence length is generally readable.");
  if(input.keyword&&kw===0){issues.push({category:"seo",severity:"high",issue:"Primary keyword is not present in the supplied content.",fix:"Use the primary keyword naturally in the title/body where contextually appropriate."});score-=10;} else if(input.keyword&&density>3){issues.push({category:"seo",severity:"medium",issue:`Primary keyword density is high (${density.toFixed(2)}%).`,fix:"Reduce repetitive exact-match wording and use natural variants/entities."});score-=5;} else if(input.keyword)strengths.push("Primary keyword usage is present without obvious overuse.");
  if(claims.length){issues.push({category:"factual-risk",severity:claims.length>=4?"high":"medium",issue:`Found ${claims.length} potentially verifiable claim(s).`,fix:"Verify each claim against authoritative evidence before publishing; remove unsupported superlatives, guarantees, prices, statistics or credentials.",evidence:claims.slice(0,12).join(", ")});score-=Math.min(18,claims.length*3);} else {strengths.push("No obvious high-risk factual claim patterns detected.");}
  if(duplicateSimilarity>=0.65){issues.push({category:"originality",severity:"high",issue:`High lexical overlap detected with supplied reference content (${Math.round(duplicateSimilarity*100)}%).`,fix:"Rewrite overlapping sections in original language and verify that any factual source material is properly attributed."});score-=12;} else if(duplicateSimilarity>=0.45){issues.push({category:"originality",severity:"medium",issue:`Moderate lexical overlap detected with supplied reference content (${Math.round(duplicateSimilarity*100)}%).`,fix:"Review similar passages and add original framing, examples and structure."});score-=6;} else if(input.referenceTexts?.length)strengths.push("No high lexical overlap detected against supplied references.");
  if((input.channel||"website")==="website"&&links===0&&ws.length>500){issues.push({category:"trust",severity:"low",issue:"No external or internal links were detected.",fix:"Add useful internal links and authoritative external references where they genuinely support the content."});score-=3;}
  score=Math.max(0,Math.min(100,Math.round(score)));
  const factualReview=claims.length>=4?{status:"high-risk" as const,claims,note:"Multiple verifiable claim patterns require human/source review before publication."}:claims.length?{status:"review-needed" as const,claims,note:"Some claims may be safe, but evidence should be checked before publication."}:{status:"low-risk" as const,claims,note:"No obvious claim-risk patterns were detected; this is not proof that every factual statement is true."};
  const verdict=score>=85&&factualReview.status!=="high-risk"?"publish-ready":score>=65?"needs-review":"needs-rework";
  return {score,verdict,metrics:{words:ws.length,sentences:ss.length,avgWordsPerSentence:Number(avg.toFixed(1)),headings,links,keywordOccurrences:kw,keywordDensity:Number(density.toFixed(2)),riskClaims:claims.length,duplicateSimilarity:Number(duplicateSimilarity.toFixed(3))},issues,strengths,factualReview};
}
