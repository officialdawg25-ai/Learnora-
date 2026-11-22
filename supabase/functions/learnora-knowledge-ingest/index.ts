import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json(405,{error:"Method not allowed"});
 const authorization=req.headers.get("Authorization");if(!authorization?.startsWith("Bearer "))return json(401,{error:"Authentication required"});
 const url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??"";
 if(!url||!anon)return json(503,{error:"Knowledge ingestion is not configured"});
 const client=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
 const {data:{user},error}=await client.auth.getUser();if(error||!user)return json(401,{error:"Invalid session"});
 let body:any;try{body=await req.json()}catch{return json(400,{error:"Invalid JSON"})}
 const title=typeof body.title==="string"?body.title.trim():"";
 const content=typeof body.content==="string"?body.content.trim():"";
 const courseId=typeof body.course_id==="string"?body.course_id:null;
 const organisationId=typeof body.organisation_id==="string"?body.organisation_id:null;
 const sourceType=body.source_type;
 const accessScope=body.access_scope??(courseId?"enrolled":"institution_private");
 if(!title||title.length>200||!content||content.length>200000||(!courseId&&!organisationId)||(courseId&&organisationId))return json(400,{error:"Provide a title, 1–200000 characters of content, and exactly one course or organisation context."});
 if(!["curriculum","course_lesson","educator_resource","institution_policy","public_reference"].includes(sourceType))return json(400,{error:"Unsupported knowledge source type"});
 if(!["public","enrolled","institution_private","academy_private"].includes(accessScope))return json(400,{error:"Unsupported access scope"});
 const {data:source,error:sourceError}=await client.from("knowledge_sources").insert({
  title,source_type:sourceType,source_url:typeof body.source_url==="string"?body.source_url.slice(0,1000):null,
  course_id:courseId,organisation_id:organisationId,access_scope:accessScope,
  language_code:typeof body.language_code==="string"?body.language_code.slice(0,12):"en",
  created_by:user.id,publication_status:"draft"
 }).select("id,title").single();
 if(sourceError||!source)return json(403,{error:"Source could not be created. Confirm you manage the selected course or institution."});
 const chars=Array.from(content),chunks:any[]=[];let start=0,index=0;
 while(start<chars.length){const end=Math.min(start+10000,chars.length);chunks.push({source_id:source.id,chunk_index:index++,content:chars.slice(start,end).join(""),language_code:typeof body.language_code==="string"?body.language_code.slice(0,12):"en"});if(end===chars.length)break;start=end-250;}
 const {error:chunkError}=await client.from("knowledge_chunks").insert(chunks);
 if(chunkError)return json(500,{error:"Source record was created but chunk storage failed. Contact Learnora support with source ID "+source.id});
 return json(201,{source_id:source.id,title:source.title,chunks_created:chunks.length,status:"draft",message:"Source is stored privately as a draft. It is not available to Learnora AI until approved and published."});
});
