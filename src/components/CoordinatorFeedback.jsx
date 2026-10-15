import { useId } from 'react';
import { FEEDBACK_CATALOG, FEEDBACK_GROUPS, choiceConflict, toggleChoice } from '../lib/evaluationFeedback';
import { RUBRIC } from '../lib/business';
export default function CoordinatorFeedback({ choices,onChange,remarks,onRemarks,disabled }) {
  const id=useId();
  return <div className="evaluation-feedback-options">
    <p className="muted-copy text-sm">Choose observations you can support. Feedback comes only from your selections and remarks, never from the numeric ratings.</p>
    {FEEDBACK_GROUPS.map(([group,title])=><fieldset key={group} disabled={disabled} className="evaluation-choice-group">
      <legend>{title}{group==='overall'?' — choose one':' — select all that apply'}</legend>
      <div className="evaluation-choice-grid">{FEEDBACK_CATALOG.groups[group].map(option=>{
        const conflict=choiceConflict(choices,group,option.id);
        return <label className="evaluation-choice" key={option.id}>
          <input type="checkbox" checked={choices[group].includes(option.id)} disabled={disabled||conflict} aria-describedby={conflict?`${id}-conflict`:undefined} onChange={()=>onChange(toggleChoice(choices,group,option.id))}/>
          <span>{option.label}</span>
        </label>;
      })}</div>
    </fieldset>)}
    <p id={`${id}-conflict`} className="muted-copy text-xs">Incompatible choices are disabled. Clear the conflicting selection to choose a different observation. “No additional concerns” and “No additional actions” are exclusive within their groups.</p>
    <label className="evaluation-field">Additional Remarks (optional)<textarea rows={3} className="form-control" maxLength={1000} value={remarks} disabled={disabled} onChange={e=>onRemarks(e.target.value)}/></label>
  </div>;
}
export function RatingAdjustments({ original,criteria,reasons,onChange,disabled,legacyReason }) {
  const changed=RUBRIC.filter(c=>criteria[c.id]!==original[c.id]);
  if(!changed.length)return null;
  return <section className="evaluation-adjustments" aria-label="Internal rating adjustment reasons">
    <h3>Explain each changed criterion</h3><p className="text-sm muted-copy">These reasons remain private to authorized staff.</p>
    {legacyReason&&<details><summary>Previously saved explanation</summary><p className="text-sm whitespace-pre-wrap">{legacyReason}</p></details>}
    {changed.map(c=><fieldset key={c.id} className="evaluation-choice-group" disabled={disabled}>
      <legend>{c.label}: original {original[c.id]}/5 → final {criteria[c.id]??'Choose rating'}/5</legend>
      <div className="evaluation-choice-grid">{FEEDBACK_CATALOG.adjustments[c.id].map(option=><label className="evaluation-choice" key={option.id}>
        <input type="radio" name={`adjust-${c.id}`} checked={reasons[c.id]?.code===option.id} onChange={()=>onChange({...reasons,[c.id]:{code:option.id,explanation:''}})}/><span>{option.label}</span>
      </label>)}</div>
      {reasons[c.id]?.code==='other'&&<label className="evaluation-field">Explain {c.label} adjustment<textarea className="form-control" rows={3} minLength={10} maxLength={500} disabled={disabled} value={reasons[c.id]?.explanation||''} onChange={e=>onChange({...reasons,[c.id]:{code:'other',explanation:e.target.value}})}/><span className="text-xs muted-copy">10–500 characters; describe the evidence or clarification.</span></label>}
    </fieldset>)}
  </section>;
}
