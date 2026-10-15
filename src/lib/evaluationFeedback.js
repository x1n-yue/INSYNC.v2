import catalog from './evaluationFeedbackCatalog.json';
import { RUBRIC, rubricScore } from './business';
export const FEEDBACK_CATALOG = catalog;
export const FEEDBACK_GROUPS = [
  ['strengths','Strengths'], ['improvements','Areas for improvement'],
  ['guidance','Recommended actions or guidance'], ['overall','Overall feedback'],
];
export const emptyChoices = () => Object.fromEntries(FEEDBACK_GROUPS.map(([key])=>[key,[]]));
export function normalizeChoices(choices) {
  if(!choices || Array.isArray(choices) || typeof choices!=='object'
    || Object.keys(choices).length!==4)throw new Error('Select valid feedback options.');
  const normalized=emptyChoices();
  for(const [group] of FEEDBACK_GROUPS) {
    const ids=choices[group],options=catalog.groups[group];
    if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!options.some(o=>o.id===id)))throw new Error('Unknown or duplicate feedback option.');
    if((group==='overall'&&ids.length>1)||(ids.includes('none')&&ids.length>1))throw new Error('Choose compatible feedback options.');
    normalized[group]=options.filter(o=>ids.includes(o.id)).map(o=>o.id);
  }
  const selected=new Set(Object.entries(normalized).flatMap(([group,ids])=>ids.map(id=>`${group}:${id}`)));
  if(catalog.conflicts.some(pair=>pair.every(id=>selected.has(id))))throw new Error('These feedback choices contradict each other.');
  return normalized;
}
export function choiceConflict(choices,group,id) {
  const selected=new Set(Object.entries(choices).flatMap(([key,ids])=>ids.map(i=>`${key}:${i}`)));
  const key=`${group}:${id}`;
  return catalog.conflicts.some(pair=>pair.includes(key)&&pair.some(other=>other!==key&&selected.has(other)));
}
export function toggleChoice(choices,group,id) {
  if(choiceConflict(choices,group,id))return choices;
  const current=choices[group];
  const next=current.includes(id)?current.filter(i=>i!==id):id==='none'||group==='overall'?[id]:[...current.filter(i=>i!=='none'),id];
  return normalizeChoices({...choices,[group]:next});
}
export function feedbackText(choices,remarks='') {
  const normalized=normalizeChoices(choices);
  if(typeof remarks!=='string'||remarks.length>1000)throw new Error('Additional remarks must be at most 1,000 characters.');
  const selectedText=group=>catalog.groups[group].filter(o=>normalized[group].includes(o.id)).map(o=>o.text).join(' ');
  const overall=selectedText('overall');
  return {summary:[overall,remarks.trim()].filter(Boolean).join('\n\n'),strengths:selectedText('strengths'),improvements:selectedText('improvements'),guidance:selectedText('guidance')};
}
export function reviewMode(review) {
  return review.feedback_mode || (['summary','strengths','improvements','guidance'].some(k=>review[k]?.trim())?'written':'selected');
}
export function adjustmentError(original,final,reasons) {
  if(rubricScore(final)===null)return 'Complete all four ratings.';
  const changed=RUBRIC.filter(c=>original[c.id]!==final[c.id]);
  if(!reasons || typeof reasons!=='object'||Array.isArray(reasons)
    ||Object.keys(reasons).some(id=>!changed.some(c=>c.id===id)))return 'Adjustment reasons must match the changed criteria.';
  for(const c of changed) {
    const reason=reasons[c.id],option=catalog.adjustments[c.id].find(o=>o.id===reason?.code);
    if(!option||typeof reason.explanation!=='string'||Object.keys(reason).length!==2)return `Select an adjustment reason for ${c.label}.`;
    if(option.id==='other'&&(reason.explanation.trim().length<10||reason.explanation.length>500||!/[\p{L}]/u.test(reason.explanation)))return `Explain the adjustment to ${c.label} in 10–500 characters.`;
    if(option.id!=='other'&&reason.explanation!=='')return `Select an adjustment reason for ${c.label}.`;
  }
  return null;
}
