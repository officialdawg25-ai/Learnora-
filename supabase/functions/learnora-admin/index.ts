import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:cors});
const permissions:Record<string,string>={educator_verification:"educators:verify",publication_review:"courses:review",knowledge_publish:"knowledge:publish",guardian_review:"guardians:verify",institution_verification:"institutions:verify",safeguarding_case:"safeguarding:manage",competency_evidence_review:"competencies:verify",opportunity_publish:"opportunities:publish",refund_approve:"finance:refund_approve",credential_issue:"credentials:issue"};
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
 let resourceType="",resourceId="",result:any=null;
 try{
  if(action==="educator_verification"){
   const decision=body.decision;if(!["verified","more_information_required","rejected"].includes(decision))return json(400,{error:"Invalid verification decision"});
   const {data:submission,error}=await admin.from("educator_verification_submissions").select("id,educator_user_id").eq("id",body.submission_id).maybeSingle();
   if(error||!submission)return json(404,{error:"Verification submission not found"});
   const {error:updateError}=await admin.from("educator_verification_submissions").update({status:decision,reviewer_user_id:user.id,reviewer_notes:notes,reviewed_at:new Date().toISOString()}).eq("id",submission.id);if(updateError)throw updateError;
   const {error:profileError}=await admin.from("educator_profiles").update({verification_status:decision}).eq("user_id",submission.educator_user_id);if(profileError)throw profileError;
   resourceType="educator_verification_submission";resourceId=submission.id;result={status:decision};
  }else if(action==="publication_review"){
   const decision=body.decision;if(!["approved","changes_requested","rejected"].includes(decision))return json(400,{error:"Invalid publication decision"});
   const {data:review,error}=await admin.from("publication_reviews").select("id,course_id").eq("id",body.review_id).eq("status","pending").maybeSingle();if(error||!review)return json(404,{error:"Pending publication review not found"});
   if(decision==="approved"){
    const {count:modules}=await admin.from("course_modules").select("id",{count:"exact",head:true}).eq("course_id",review.course_id);
    const {data:moduleRows}=await admin.from("course_modules").select("id").eq("course_id",review.course_id);
    const ids=(moduleRows??[]).map((x:any)=>x.id);
    const {count:lessons}=ids.length?await admin.from("lessons").select("id",{count:"exact",head:true}).in("module_id",ids):{count:0};
    if((modules??0)<1||(lessons??0)<1)return json(422,{error:"A course needs at least one module and one lesson before approval."});
   }
   const next=decision==="approved"?"published":decision==="changes_requested"?"draft":"archived";
   const {error:courseError}=await admin.from("courses").update({publication_status:next,published_at:decision==="approved"?new Date().toISOString():null}).eq("id",review.course_id);if(courseError)throw courseError;
   const {error:reviewError}=await admin.from("publication_reviews").update({status:decision,reviewer_user_id:user.id,reviewer_notes:notes,reviewed_at:new Date().toISOString()}).eq("id",review.id);if(reviewError)throw reviewError;
   resourceType="publication_review";resourceId=review.id;result={status:decision};
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
   const decision=body.decision;if(!["active","suspended","archived"].includes(decision))return json(400,{error:"Invalid institution decision"});
   const {data:org,error}=await admin.from("organisations").update({status:decision,updated_at:new Date().toISOString()}).eq("id",body.organisation_id).select("id").maybeSingle();if(error||!org)return json(404,{error:"Institution not found"});
   resourceType="organisation";resourceId=org.id;result={status:decision};
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
