import { useId } from 'react';
import { RUBRIC, rubricScore } from '../lib/business';
import './evaluation.css';
export const RATING_SCALE = ['Poor','Fair','Satisfactory','Good','Excellent'];
export default function EvaluationRatings({ value,onChange,disabled=false }) {
  const id=useId();
  return <div className="evaluation-ratings">
    <p className="evaluation-scale" id={`${id}-scale`}>1 Poor · 2 Fair · 3 Satisfactory · 4 Good · 5 Excellent</p>
    <div className="evaluation-rating-grid">{RUBRIC.map(c=><fieldset key={c.id} className="evaluation-rating-criterion" disabled={disabled} role="radiogroup" aria-labelledby={`${id}-${c.id}`} aria-describedby={`${id}-scale`}>
      <legend id={`${id}-${c.id}`}>{c.label} <span>({c.weight}%)</span></legend>
      <div className="evaluation-rating-options">{RATING_SCALE.map((label,i)=><label className="evaluation-rating-option" key={label}>
        <input type="radio" name={`${id}-${c.id}`} aria-label={`${i+1} — ${label}`} value={i+1} checked={value[c.id]===i+1} onChange={()=>onChange({...value,[c.id]:i+1})}/>
        <span aria-hidden="true">{i+1}</span>
      </label>)}</div>
    </fieldset>)}</div>
    <p className="evaluation-scale">Score preview: <strong>{rubricScore(value)??'Complete all four ratings'}</strong>{rubricScore(value)!==null&&'/100'}. The saved score is calculated by the server.</p>
  </div>;
}
