import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { createHash, timingSafeEqual } from "node:crypto";
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const env=(k:string)=>Deno.env.get(k)??"";
const enc=(v:string)=>encodeURIComponent(v.trim()).replace(/%20/g,"+");
function expectedSignature(params:URLSearchParams,passphrase:string){const parts:string[]=[];for(const [k,v] of params.entries()){if(k!=="signature")parts.push(`${k}=${enc(v)}`);}if(passphrase)parts.push(`passphrase=${enc(passphrase)}`);return createHash("md5").update(parts.join("&")).digest("hex");}
function safeEqual(a:string,b:string){const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);return x.length===y.length&&timingSafeEqual(x,y);}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json(405,{error:"Method not allowed"});
 const url=env("SUPABASE_URL"),service=env("SUPABASE_SERVICE_ROLE_KEY"),merchant=env("PAYFAST_MERCHANT_ID"),passphrase=env("PAYFAST_PASSPHRASE");
 if(!url||!service||!merchant)return json(503,{error:"Payment notification service is not configured."});
 const mode=env("PAYFAST_MODE")||"sandbox";if(mode!=="sandbox")return json(503,{error:"Only sandbox notifications are enabled."});
 const raw=await req.text();if(raw.length>100_000)return json(413,{error:"Notification too large"});
 const params=new URLSearchParams(raw),received=params.get("signature")??"";
 if(!received||!safeEqual(received,expectedSignature(params,passphrase)))return json(400,{error:"Invalid PayFast signature"});
 if(params.get("merchant_id")!==merchant)return json(400,{error:"Merchant mismatch"});
 const paymentStatus=params.get("payment_status")??"";
 const merchantPaymentId=params.get("m_payment_id")??"";
 const providerReference=params.get("pf_payment_id")??"";
 if(!merchantPaymentId||!providerReference)return json(400,{error:"Missing payment references"});
 const validation=await fetch("https://sandbox.payfast.co.za/eng/query/validate",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:raw});
 const validationText=(await validation.text()).trim();
 if(!validation.ok||validationText!=="VALID")return json(400,{error:"PayFast server validation failed"});
 const admin=createClient(url,service);
 const {data:payment,error:paymentError}=await admin.from("payment_transactions").select("id,amount_minor,currency,order_id").eq("merchant_payment_id",merchantPaymentId).maybeSingle();
 if(paymentError||!payment)return json(404,{error:"Payment reference not found"});
 const gross=Math.round(Number(params.get("amount_gross"))*100);
 if(!Number.isFinite(gross)||gross!==Number(payment.amount_minor)||payment.currency!=="ZAR")return json(400,{error:"Payment amount or currency mismatch"});
 if(paymentStatus!=="COMPLETE"){
  if(paymentStatus==="FAILED"||paymentStatus==="CANCELLED")await admin.from("payment_transactions").update({status:paymentStatus==="FAILED"?"failed":"cancelled",failure_code:paymentStatus,updated_at:new Date().toISOString()}).eq("id",payment.id).eq("status","initiated");
  return json(200,{received:true,processed:false,status:paymentStatus});
 }
 const digest=createHash("sha256").update(raw).digest("hex");
 const {data,error}=await admin.rpc("process_verified_payfast_payment",{p_merchant_payment_id:merchantPaymentId,p_provider_reference:providerReference,p_amount_minor:gross,p_event_id:providerReference,p_payload_hash:digest});
 if(error)return json(500,{error:"Verified notification could not be posted. PayFast may retry."});
 return json(200,{received:true,result:data});
});
