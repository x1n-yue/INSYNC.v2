// Actual REST gateway: public/anonymous denial only, no credentials printed.
import {loadEnv} from 'vite';
import {writeFileSync} from 'node:fs';
const env=loadEnv('development',process.cwd(),'VITE_');
const url=new URL(env.VITE_SUPABASE_URL),key=env.VITE_SUPABASE_ANON_KEY;
if(url.hostname!=='upnkotnmoeaykummcnlx.supabase.co')throw Error('Wrong REST project: stop');
if(!key?.startsWith('sb_publishable_')){
 let role;try{role=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role;}catch{throw Error('Invalid public API key');}
 if(role!=='anon')throw Error('Refusing any privileged API key');
}
const probes=[['profiles','GET','profiles?select=id&limit=1',null],
 ['verify_attendance','POST','rpc/verify_attendance',{p_id:null,p_expected_in:null,p_expected_out:null}],
 ['send_announcement','POST','rpc/send_announcement',{p_request_id:null,p_title:'',p_body:'',p_target_intern_id:null}]];
const results=[];
for(const[name,method,path,body]of probes){
 const res=await fetch(`${url.origin}/rest/v1/${path}`,{method,headers:{apikey:key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const reply=await res.json();results.push({name,status:res.status,code:reply.code||null,denied:res.status>=400&&reply.code==='42501'});
}
writeFileSync('.insync-recovery/rest-verification.json',JSON.stringify({project:url.hostname,results},null,2));
console.log(JSON.stringify({project:url.hostname,results},null,2));
if(results.some(r=>!r.denied))throw Error('REST permission/cache check failed; inspect private results');
