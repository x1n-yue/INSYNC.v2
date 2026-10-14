import { recordRpc } from './authority';

export async function sendAnnouncement(client, { requestId, authorId, title, body, targetInternId = null }) {
  const subject=title.trim(), message=body.trim();
  if (!subject || !message) return {ok:false,error:'Enter a subject and message.'};
  const result=await recordRpc(client,'send_announcement',{
    p_request_id:requestId,p_title:subject,p_body:message,p_target_intern_id:targetInternId,
  });
  if(result.ok && (result.data.id!==requestId || result.data.instructor_id!==authorId
    || result.data.title!==subject || result.data.body!==message
    || (result.data.target_intern_id??null)!==targetInternId
    || !Array.isArray(result.data.recipient_ids) || !result.data.recipient_ids.length
    || new Set(result.data.recipient_ids).size!==result.data.recipient_ids.length
    || (targetInternId && (result.data.recipient_ids.length!==1 || result.data.recipient_ids[0]!==targetInternId))))
    return {ok:false,error:'Announcement outcome unknown. Retry the same draft to confirm it.'};
  return result;
}
