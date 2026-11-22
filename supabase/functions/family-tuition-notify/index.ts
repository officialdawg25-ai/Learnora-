import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.58.0";
import {createHash,timingSafeEqual} from "node:crypto";
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const env=(k:string)=>Deno.env.get(k)??"";
const enc=(v:string)=>encodeURIComponent(v.trim()).replace(/%20/g,"+");
function signature(params:URLSearchParams,passphrase:string){const parts:string[]=[];for(const [k,v] of params.entries()){if(k!=="signature")parts.push(`${k}=${enc(v)}`)}if(passphrase)parts.push(`passphrase=${enc(passphrase)}`);return createHash("md5").update(parts.join("&")).digest("hex")}
function safeEqual(a:string,b:string){const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);return x.length===y.length&&timingSafeEqual(x,y)}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json(405,{error:"Method not allowed"});
 const url=env("SUPABASE_URL"),service=env("SUPABASE_SERVICE_ROLE_KEY"),merchant=env("PAYFAST_MERCHANT_ID"),passphrase=env("PAYFAST_PASSPHRASE");
 if(!url||!service||!merchant)return json(503,{error:"Tuition notification service is not configured"});
 if((env("PAYFAST_MODE")||"sandbox")!=="sandbox")return json(503,{error:"Production notifications are not enabled"});
 const raw=await req.text();if(raw.length>100000)return json(413,{error:"Notification too large"});
 const params=new URLSearchParams(raw),received=params.get("signature")??"";
 if(!received||!safeEqual(received,signature(params,passphrase)))return json(400,{error:"Invalid signature"});
 if(params.get("merchant_id")!==merchant)return json(400,{error:"Merchant mismatch"});
 const paymentId=params.get("custom_str1")??"",providerRef=params.get("pf_payment_id")??"",status=params.get("payment_status")??"";
 if(!paymentId||!providerRef)return json(400,{error:"Missing payment references"});
 const validation=await fetch("https://sandbox.payfast.co.za/eng/query/validate",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:raw});
 if(!validation.ok||(await validation.text()).trim()!=="VALID")return json(400,{error:"PayFast server validation failed"});
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:payment,error}=await admin.from("family_tuition_payments").select("id,amount_minor,currency,status").eq("id",paymentId).maybeSingle();
 if(error||!payment)return json(404,{error:"Payment reference not found"});
 const gross=Math.round(Number(params.get("amount_gross"))*100);
 if(gross!==Number(payment.amount_minor)||payment.currency!=="ZAR")return json(400,{error:"Payment amount or currency mismatch"});
 if(status!=="COMPLETE"){
  if(["FAILED","CANCELLED"].includes(status))await admin.from("family_tuition_payments").update({status:status==="FAILED"?"failed":"cancelled"}).eq("id",paymentId).eq("status","initiated");
  return json(200,{received:true,processed:false,status});
 }
 const digest=createHash("sha256").update(raw).digest("hex");
 const {data,resultError}=await admin.rpc("process_verified_tuition_payment",{p_payment_id:paymentId,p_provider_reference:providerRef,p_amount_minor:gross,p_event_id:providerRef,p_payload_hash:digest});
 if(resultError)return json(500,{error:"Verified tuition payment could not be posted. PayFast may retry"});
 return json(200,{received:true,result:data});
});
