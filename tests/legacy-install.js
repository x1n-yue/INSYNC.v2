// Historical M14 contract ONLY, for regression tests of retired workflows/tools.
// Latest installation and retirement authorization are tested separately.
import { readFileSync } from 'node:fs';
export async function installLegacyM14(db, { initial=false }={}) {
  const read=f=>readFileSync(new URL(`../supabase/${f}`,import.meta.url),'utf8');
  if(initial) {
    // Our synthetic provider double already has a bucket; bootstrap needs an empty bucket catalog.
    await db.query("delete from storage.buckets where id='documents'; alter table storage.buckets add column if not exists name text");
    await db.query(read('initial_schema.sql'));
  }
  for(const name of ['M01_authority','M02_trusted_audit','M03_attendance_integrity','M04_private_documents_bucket','M05_validate_attendance','M06_rubric_hours','M07_account_lifecycle','M08_document_versions','M09_validate_domain','M10_flexible_submissions','M11_admin_history','M12_handover_workflows','M13_coordinator_operations','M14_last_admin_protection'])await db.query(read(`migrations/${name}.sql`));
}
