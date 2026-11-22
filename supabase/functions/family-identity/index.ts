import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
const env=(key:string)=>Deno.env.get(key)??"";
const usernamePattern=/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}$/;
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return json(405,{error:"Method not allowed"});
 const url=env("SUPABASE_URL"),anon=env("SUPABASE_ANON_KEY"),service=env("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!service)return json(503,{error:"Learner identity service is not configured."});
 let body:any;try{const raw=await req.text();if(raw.length>20000)return json(413,{error:"Request too large"});body=JSON.parse(raw)}catch{return json(400,{error:"Invalid request body"});}
 const action=String(body.action??"");
 if(action==="username_sign_in"){
  const username=String(body.username??"").trim().toLowerCase(),password=String(body.password??"");
  if(!usernamePattern.test(username)||!password)return json(401,{error:"Invalid username or password."});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity}=await admin.from("learner_login_usernames").select("login_email").eq("username_normalized",username).maybeSingle();
  if(!identity)return json(401,{error:"Invalid username or password."});
  const authClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await authClient.auth.signInWithPassword({email:identity.login_email,password});
  if(error||!data.session)return json(401,{error:"Invalid username or password."});
  return json(200,{access_token:data.session.access_token,refresh_token:data.session.refresh_token,expires_at:data.session.expires_at,token_type:data.session.token_type});
 }
 if(action!=="create_learner")return json(400,{error:"Unsupported identity action."});
 const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return json(401,{error:"Sign in required."});
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user:parent},error:authError}=await caller.auth.getUser();
 if(authError||!parent)return json(401,{error:"Invalid session."});
 const {data:parentRole,error:roleError}=await admin.from("user_roles").select("user_id").eq("user_id",parent.id).eq("role","parent_guardian").eq("status","active").maybeSingle();
 if(roleError||!parentRole)return json(403,{error:"An active parent or guardian account is required."});
 const username=String(body.username??"").trim(),normalized=username.toLowerCase();
 const first=String(body.first_name??"").trim(),last=String(body.last_name??"").trim();
 const dob=String(body.date_of_birth??"").trim(),password=String(body.temporary_password??"");
 if(!usernamePattern.test(username))return json(400,{error:"Choose a username of 3–30 letters, numbers, dots, underscores or hyphens."});
 if(!first||!last||first.length>80||last.length>80)return json(400,{error:"Learner first and last names are required."});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||new Date(dob)>=new Date())return json(400,{error:"Enter a valid learner date of birth."});
 if(password.length<12||password.length>128)return json(400,{error:"Temporary password must contain at least 12 characters."});
 const {data:existing}=await admin.from("learner_login_usernames").select("user_id").eq("username_normalized",normalized).maybeSingle();
 if(existing)return json(409,{error:"That username is unavailable. Choose another."});
 const loginEmail=`${normalized}@learnora.login.invalid`;
 const displayName=`${first} ${last}`;
 const {data:created,error:createError}=await admin.auth.admin.createUser({
  email:loginEmail,password,email_confirm:true,
  user_metadata:{display_name:displayName,date_of_birth:dob,signup_intent:"learner",username,created_by_parent:parent.id,temporary_credential:true}
 });
 if(createError||!created.user)return json(400,{error:createError?.message??"Learner account could not be created."});
 const learnerId=created.user.id;
 try{
  const {error:roleInsertError}=await admin.from("user_roles").insert({user_id:learnerId,role:"learner",status:"active",source:"self_service"});
  if(roleInsertError)throw roleInsertError;
  const {error:usernameError}=await admin.from("learner_login_usernames").insert({user_id:learnerId,username,username_normalized:normalized,login_email:loginEmail,issued_by_parent:parent.id});
  if(usernameError)throw usernameError;
  const grade=typeof body.grade_label==="string"?body.grade_label.trim().slice(0,80):null;
  const classLabel=typeof body.class_label==="string"?body.class_label.trim().slice(0,80):null;
  const academicYear=Number.isInteger(body.academic_year)?body.academic_year:null;
  const {error:detailError}=await admin.from("family_learner_details").insert({learner_user_id:learnerId,grade_label:grade,class_label:classLabel,academic_year:academicYear,preferred_language:String(body.preferred_language??"en").slice(0,12),created_by_parent:parent.id});
  if(detailError)throw detailError;
  const {error:relationshipError}=await caller.rpc("request_guardian_connection",{
   p_learner_user_id:learnerId,p_relationship_type:"parent",
   p_consent_scopes:["learning_progress","assessment_reports"],
   p_evidence_reference:null,p_consent_version:"learnora-guardian-connection-v1"
  });
  if(relationshipError)throw relationshipError;
  await admin.from("family_audit_events").insert({actor_user_id:parent.id,subject_user_id:learnerId,action:"learner_account_created",resource_type:"learner",resource_id:learnerId,metadata:{username,relationship_status:"pending_verification"}});
  return json(200,{success:true,learner_id:learnerId,username,display_name:displayName,relationship_status:"pending_verification",message:"Learner account created. Guardian access remains pending learner acknowledgement and independent authority verification."});
 }catch(error){
  await admin.auth.admin.deleteUser(learnerId);
  return json(400,{error:error instanceof Error?error.message:"Learner setup could not be completed."});
 }
});
