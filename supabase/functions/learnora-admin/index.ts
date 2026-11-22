import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:cors});
const permissions:Record<string,string>={educator_verification:"educators:verify",publication_review:"courses:review",knowledge_publish:"knowledge:publish",guardian_review:"guardians:verify",institution_verification:"institutions:verify",safeguarding_case:"safeguarding:manage",competency_evidence_review:"competencies:verify",opportunity_publish:"opportunities:publish",refund_approve:"finance:refund_approve",credential_issue:"credentials:issue",dashboard:"platform:dashboard"};
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json(405,{error:"Method not allowed"});
 const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return json(401,{error:"Authentication required"});
 const url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
 if(!url||!anon||!service)return json(503,{error:"Platform administration is not configured"});
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}}),admin=createClient(url,service);
 const {data:{user},error:authError}=await userClient.auth.getUser();if(authError||!user)return json(401,{error:"Invalid session"});
 let body:any;try{body=await req.json()}catch{return json(400,{error:"Invalid JSON"})}
 const action=String(body.action??""),permission=permissions[action];
 if(!permission)return json(400,{error:"Unsupported administrative action"});
 const {data:administrator}=await admin.from("platform_administrators").select("role,permissions,status").eq("user_id",user.id).maybeSingle();
 if(!administrator||administrator.status!=="active"||!administrator.permissions.includes(permission))return json(403,{error:"This account is not authorised for that platform operation."});
 const notes=typeof body.notes==="string"?body.notes.slice(0,4000):null;
 if(action==="dashboard"){
  const dashboard:any={educator_verifications:[],publication_reviews:[],guardian_requests:[],institutions:[],refunds:[],safeguarding_cases:[],competency_evidence:[],opportunities:[],knowledge_sources:[]};
  if(administrator.permissions.includes("educators:verify")){
   const {data}=await admin.from("educator_verification_submissions").select("id,educator_user_id,credential_type,issuer,credential_reference,document_storage_path,status,submitted_at").eq("status","pending").order("submitted_at").limit(25);
   dashboard.educator_verifications=await Promise.all((data??[]).map(async(row:any)=>{const signed=row.document_storage_path?await admin.storage.from("learnora-verification").createSignedUrl(row.document_storage_path,120):{data:null};return {...row,evidence_url:signed.data?.signedUrl??null};}));
  }
  if(administrator.permissions.includes("courses:review")){const {data}=await admin.from("publication_reviews").select("id,course_id,requested_by,requested_at,courses(title)").eq("status","pending").order("requested_at").limit(25);dashboard.publication_reviews=data??[];}
  if(administrator.permissions.includes("guardians:verify")){const {data}=await admin.from("guardian_relationships").select("id,guardian_user_id,learner_user_id,relationship_type,consent_scopes,consent_version,evidence_reference,created_at").eq("status","pending").order("created_at").limit(25);dashboard.guardian_requests=data??[];}
  if(administrator.permissions.includes("institutions:verify")){const {data}=await admin.from("institution_verification_submissions").select("id,organisation_id,reference_type,evidence_reference,submitted_by,created_at,organisations(name,organisation_type)").eq("status","pending").order("created_at").limit(25);dashboard.institutions=data??[];}
  if(administrator.permissions.includes("finance:refund_approve")){const {data}=await admin.from("refunds").select("id,order_id,amount_minor,currency,reason,requested_at").eq("status","requested").order("requested_at").limit(25);dashboard.refunds=data??[];}
  if(administrator.permissions.includes("safeguarding:manage")){const {data}=await admin.from("safeguarding_cases").select("id,reporter_user_id,subject_user_id,category,severity,description,status,created_at").in("status",["open","triage","investigating"]).order("created_at").limit(25);dashboard.safeguarding_cases=data??[];}
  if(administrator.permissions.includes("competencies:verify")){const {data}=await admin.from("learner_competency_evidence").select("id,learner_user_id,competency_id,evidence_type,evidence_reference,created_at").eq("verification_status","pending_review").order("created_at").limit(25);dashboard.competency_evidence=data??[];}
  if(administrator.permissions.includes("knowledge:publish")){const {data}=await admin.from("knowledge_sources").select("id,title,source_type,source_url,created_by,created_at").eq("publication_status","draft").order("created_at").limit(25);dashboard.knowledge_sources=data??[];}
  if(administrator.permissions.includes("opportunities:publish")){const {data}=await admin.from("learning_opportunities").select("id,title,provider_name,source_url,verification_source,verified_at,deadline").eq("publication_status","draft").order("created_at").limit(25);dashboard.opportunities=data??[];}
  return json(200,{success:true,action,dashboard});
 }
 let resourceType="",resourceId="",result:any=null;
 try{
  if(action==="educator_verification"){
   const decision=body.decision;if(!["verified","more_information_required","rejected"].includes(decision))return json(400,{error:"Invalid verification decision"});
   const submissionId=typeof body.submission_id==="string"?body.submission_id:"";if(!submissionId)return json(400,{error:"Verification submission ID is required"});
   const {data:reviewResult,error:reviewError}=await admin.rpc("review_educator_verification",{p_submission_id:submissionId,p_decision:decision,p_reviewer_id:user.id,p_notes:notes});
   if(reviewError?.code==="P0002")return json(404,{error:"Pending verification submission not found"});
   if(reviewError)throw reviewError;
   resourceType="educator_verification_submission";resourceId=submissionId;result=reviewResult;
  }else if(action==="publication_review"){
   const decision=body.decision;if(!["approved","changes_requested","rejected"].includes(decision))return json(400,{error:"Invalid publication decision"});
   const reviewId=typeof body.review_id==="string"?body.review_id:"";if(!reviewId)return json(400,{error:"Publication review ID is required"});
   const {data:reviewResult,error:reviewError}=await admin.rpc("review_course_publication",{p_review_id:reviewId,p_decision:decision,p_reviewer_id:user.id,p_notes:notes});
   if(reviewError?.code==="P0002")return json(404,{error:"Pending publication review not found"});
   if(reviewError?.code==="23514")return json(422,{error:"A course needs at least one module and one lesson before approval."});
   if(reviewError)throw reviewError;
   resourceType="publication_review";resourceId=reviewId;result=reviewResult;
  }else if(action==="knowledge_publish"){
   const {data:source,error}=await admin.from("knowledge_sources").select("id").eq("id",body.source_id).eq("publication_status","draft").maybeSingle();if(error||!source)return json(404,{error:"Draft knowledge source not found"});
   const {count}=await admin.from("knowledge_chunks").select("id",{count:"exact",head:true}).eq("source_id",source.id);if((count??0)<1)return json(422,{error:"A source needs at least one chunk before publication."});
   const {error:updateError}=await admin.from("knowledge_sources").update({publication_status:"published",updated_at:new Date().toISOString()}).eq("id",source.id);if(updateError)throw updateError;
   resourceType="knowledge_source";resourceId=source.id;result={status:"published",chunks:count};
  }else if(action==="guardian_review"){
   const decision=body.decision;if(!["active","rejected"].includes(decision))return json(400,{error:"Invalid guardian decision"});
   const {data:rel,error}=await admin.from("guardian_relationships").select("id,consent_version,evidence_reference").eq("id",body.relationship_id).eq("status","pending").maybeSingle();if(error||!rel)return json(404,{error:"Pending guardian request not found"});
   const approvedVersion=Deno.env.get("LEARNORA_GUARDIAN_CONSENT_VERSION");
   if(decision==="active"&&(!rel.evidence_reference||!approvedVersion||rel.consent_version!==approvedVersion))return json(422,{error:"Guardian activation requires independently verified authority evidence and the currently approved consent version."});
   const {error:updateError}=await admin.from("guardian_relationships").update({status:decision,verified_by:user.id,verified_at:new Date().toISOString()}).eq("id",rel.id);if(updateError)throw updateError;
   resourceType="guardian_relationship";resourceId=rel.id;result={status:decision};
  }else if(action==="institution_verification"){
   const decision=body.decision;if(!["verified","more_information_required","rejected"].includes(decision))return json(400,{error:"Invalid institution verification decision"});
   const submissionId=typeof body.submission_id==="string"?body.submission_id:"";
   if(!submissionId)return json(400,{error:"Institution verification submission ID is required"});
   const {data:review,error}=await admin.rpc("review_institution_verification",{p_submission_id:submissionId,p_decision:decision,p_reviewer_id:user.id,p_notes:notes});
   if(error?.code==="P0002")return json(404,{error:"Pending institution verification not found"});
   if(error)throw error;
   resourceType="institution_verification_submission";resourceId=submissionId;result=review;
  }else if(action==="safeguarding_case"){
   const next=body.status;if(!["triage","investigating","resolved","closed"].includes(next))return json(400,{error:"Invalid safeguarding case status"});
   const {data:caseRow,error}=await admin.from("safeguarding_cases").update({status:next,assigned_to:user.id,resolution_notes:notes,resolved_at:["resolved","closed"].includes(next)?new Date().toISOString():null}).eq("id",body.case_id).select("id").maybeSingle();if(error||!caseRow)return json(404,{error:"Safeguarding case not found"});
   resourceType="safeguarding_case";resourceId=caseRow.id;result={status:next};
  }else if(action==="competency_evidence_review"){
   const decision=body.decision;if(!["verified","rejected"].includes(decision))return json(400,{error:"Invalid evidence decision"});
   const {data:evidence,error}=await admin.from("learner_competency_evidence").update({verification_status:decision,verified_by:user.id,verified_at:new Date().toISOString()}).eq("id",body.evidence_id).select("id").maybeSingle();if(error||!evidence)return json(404,{error:"Competency evidence not found"});
   resourceType="competency_evidence";resourceId=evidence.id;result={status:decision};
  }else if(action==="opportunity_publish"){
   const {data:opportunity,error}=await admin.from("learning_opportunities").select("id,source_url,verification_source,verified_at,deadline").eq("id",body.opportunity_id).maybeSingle();if(error||!opportunity)return json(404,{error:"Opportunity not found"});
   if(!opportunity.source_url||!opportunity.verification_source||!opportunity.verified_at||(opportunity.deadline&&opportunity.deadline<new Date().toISOString().slice(0,10)))return json(422,{error:"Opportunity source, verification evidence and valid deadline are required."});
   const {error:updateError}=await admin.from("learning_opportunities").update({publication_status:"published",updated_at:new Date().toISOString()}).eq("id",opportunity.id);if(updateError)throw updateError;
   resourceType="learning_opportunity";resourceId=opportunity.id;result={status:"published"};
  }else if(action==="refund_approve"){
   const {data:refund,error}=await admin.from("refunds").update({status:"approved"}).eq("id",body.refund_id).eq("status","requested").select("id").maybeSingle();if(error||!refund)return json(404,{error:"Refund request not found or no longer pending"});
   resourceType="refund";resourceId=refund.id;result={status:"approved",message:"Approval recorded. This does not mean the provider has completed the refund."};
  }else if(action==="credential_issue"){
   const type=body.credential_type;if(!["platform_completion","institution_issued","accredited_qualification"].includes(type))return json(400,{error:"Invalid credential type"});
   const issuer=String(body.issuer_name??"").trim(),title=String(body.credential_title??"").trim();
   if(!issuer||!title)return json(400,{error:"Issuer and credential title are required."});
   if(type==="accredited_qualification"&&!body.accreditation_reference)return json(422,{error:"Accreditation reference is mandatory for accredited qualification claims."});
   const identifier=`LRN-${crypto.randomUUID().toUpperCase()}`;
   const {data:credential,error}=await admin.from("credentials").insert({credential_identifier:identifier,recipient_user_id:body.recipient_user_id,issuer_name:issuer.slice(0,160),issuer_organisation_id:body.issuer_organisation_id??null,academy_id:body.academy_id??null,course_id:body.course_id??null,credential_title:title.slice(0,200),credential_type:type,accreditation_reference:body.accreditation_reference??null}).select("id,credential_identifier").single();
   if(error||!credential)throw error??new Error("Credential creation failed");
   resourceType="credential";resourceId=credential.id;result=credential;
  }
  await admin.from("audit_events").insert({actor_user_id:user.id,action:`platform_admin:${action}`,resource_type:resourceType,resource_id:resourceId,metadata:{decision:body.decision??body.status??null,notes_present:!!notes}});
  return json(200,{success:true,action,result});
 }catch(error){return json(500,{error:error instanceof Error?error.message:"Administrative action failed"});}
});
