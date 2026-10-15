import { describe,it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EvaluationRatings from '../src/components/EvaluationRatings';
import { RUBRIC, rubricScore } from '../src/lib/business';
import { adjustmentError, choiceConflict, emptyChoices, FEEDBACK_CATALOG, feedbackText, normalizeChoices, reviewMode, toggleChoice } from '../src/lib/evaluationFeedback';
const ratings={punctuality:4,performance:5,conduct:3,communication:2};
describe('shared evaluation controls and deterministic feedback',()=>{
  it('renders native labeled single-selection groups with the original rubric/scale',()=>{
    const markup=renderToStaticMarkup(<EvaluationRatings value={ratings} onChange={()=>{}}/>);
    expect((markup.match(/type="radio"/g)||[])).toHaveLength(20);expect((markup.match(/checked=""/g)||[])).toHaveLength(4);
    expect(markup).not.toContain('<select');expect(markup).toContain('radiogroup');expect(markup).toContain('75');
    for(const c of RUBRIC){expect(markup).toContain(c.label.replaceAll('&','&amp;'));expect(markup).toContain(`${c.weight}%`);}
  });
  it('disables the native fieldsets during saves and shows incomplete rather than invented scores',()=>{
    const html=renderToStaticMarkup(<EvaluationRatings value={{punctuality:4}} onChange={()=>{}} disabled/>);
    expect((html.match(/disabled=""/g)||[])).toHaveLength(4);expect(html).toContain('Complete all four ratings');expect(rubricScore({punctuality:4})).toBeNull();
  });
  it('makes no rating-based observations and requires explicit feedback choices',()=>{
    expect(feedbackText(emptyChoices())).toEqual({summary:'',strengths:'',improvements:'',guidance:''});
    const choices=toggleChoice(emptyChoices(),'overall','progress');expect(feedbackText(choices).summary).toBe(FEEDBACK_CATALOG.groups.overall.find(o=>o.id==='progress').text);
    expect(feedbackText(choices,'  Extra student guidance.\n').summary).toBe(`${feedbackText(choices).summary}\n\nExtra student guidance.`);
  });
  it('allows multiple independent choices, canonicalizes order, and makes None/overall exclusive',()=>{
    let choices=toggleChoice(emptyChoices(),'strengths','teamwork');choices=toggleChoice(choices,'strengths','quality');
    expect(choices.strengths).toEqual(['quality','teamwork']);choices=toggleChoice(choices,'improvements','communication');choices=toggleChoice(choices,'improvements','none');expect(choices.improvements).toEqual(['none']);
    choices=toggleChoice(choices,'improvements','quality');expect(choices.improvements).toEqual(['none']); // conflicting strength blocks the choice
    choices=toggleChoice(choices,'overall','progress');choices=toggleChoice(choices,'overall','meeting');expect(choices.overall).toEqual(['meeting']);
  });
  it('rejects contradictory, unknown, duplicate and malformed selections before preview',()=>{
    for(const choices of [{...emptyChoices(),improvements:['none','communication']},{...emptyChoices(),strengths:['quality','quality']},{...emptyChoices(),overall:['progress','meeting']},{...emptyChoices(),guidance:['unknown']},{...emptyChoices(),strengths:['communication'],improvements:['communication']}])expect(()=>normalizeChoices(choices)).toThrow();
    expect(choiceConflict({...emptyChoices(),strengths:['punctuality']},'improvements','punctuality')).toBe(true);
    expect(()=>feedbackText(emptyChoices(),'a'.repeat(1001))).toThrow(/1,000/);
  });
  it('uses explicit reasons for each changed criterion; Other needs text, and reverting removes the need',()=>{
    const final={...ratings,punctuality:5,conduct:4};expect(adjustmentError(ratings,final,{})).toMatch(/Punctuality/);
    expect(adjustmentError(ratings,final,{punctuality:{code:'attendance_records',explanation:''}})).toMatch(/Professional Conduct/);
    expect(adjustmentError(ratings,final,{punctuality:{code:'attendance_records',explanation:''},conduct:{code:'other',explanation:' '}})).toMatch(/10–500/);
    expect(adjustmentError(ratings,final,{punctuality:{code:'attendance_records',explanation:''},conduct:{code:'conduct_evidence',explanation:''}})).toBeNull();
    expect(adjustmentError(ratings,ratings,{})).toBeNull();
  });
  it('detects written legacy drafts without replacing their content or inferring selections',()=>{
    expect(reviewMode({summary:'Original saved words',feedback_mode:null})).toBe('written');expect(reviewMode({summary:'',strengths:'Saved strength'})).toBe('written');expect(reviewMode({summary:'',strengths:'',guidance:''})).toBe('selected');
    expect(reviewMode({summary:'Generated text',feedback_mode:'selected'})).toBe('selected');
  });
});
