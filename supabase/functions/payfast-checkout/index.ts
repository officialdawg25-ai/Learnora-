import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { createHash } from "node:crypto";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:cors});
const env=(k:string)=>Deno.env.get(k)??"";
const enc=(v:string)=>encodeURIComponent(v).replace(/%20/g,"+");
function signature(params:URLSearchParams,passphrase:string){const pairs:string[]=[];for(const [k,v] of params.entries()){if(k!=="signature")pairs.push(`${k}=${enc(v.trim())}`);}if(passphrase)pairs.push(`passphrase=${enc(passphrase.trim())}`);return createHash("md5").update(pairs.join("&")).digest("hex");}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json(405,{error:"Method not allowed"});
 const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return json(401,{error:"Sign in required"});
 const url=env("SUPABASE_URL"),anon=env("SUPABASE_ANON_KEY"),service=env("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!service)return json(503,{error:"Payment service is not configured."});
 if((env("PAYFAST_MODE")||"sandbox")!=="sandbox")return json(503,{error:"Only PayFast sandbox checkout is enabled. Production payments are deliberately disabled."});
 const merchant=env("PAYFAST_MERCHANT_ID"),passphrase=env("PAYFAST_PASSPHRASE");
 const returnUrl=env("PAYFAST_RETURN_URL"),cancelUrl=env("PAYFAST_CANCEL_URL"),notifyUrl=env("PAYFAST_NOTIFY_URL");
 if(!merchant||!returnUrl||!cancelUrl||!notifyUrl)return json(503,{error:"PayFast sandbox merchant and return/notify URLs must be configured."});
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}}),admin=createClient(url,service);
 const {data:{user},error:authError}=await userClient.auth.getUser();if(authError||!user)return json(401,{error:"Invalid session"});
 let body:any;try{body=await req.json()}catch{return json(400,{error:"Invalid request body"})}
 const courseId=typeof body.course_id==="string"?body.course_id:"";
 const key=typeof body.idempotency_key==="string"?body.idempotency_key:"";
 if(!courseId||!key||key.length>120)return json(400,{error:"Course and idempotency key are required."});
 const {data:course,error:courseError}=await userClient.from("courses").select("id,title,price_minor,currency,access_type,publication_status,academy_id,academies!inner(status)").eq("id",courseId).maybeSingle();
 if(courseError||!course||course.publication_status!=="published"||course.access_type!=="paid"||(course.academies as any)?.status!=="published")return json(404,{error:"Published paid course not found."});
 if(course.currency!=="ZAR"||Number(course.price_minor)<=0)return json(400,{error:"Only positive ZAR course prices are supported by the current sandbox checkout."});
 const {data:existingEnrolment}=await userClient.from("enrolments").select("id").eq("course_id",courseId).eq("learner_id",user.id).in("status",["active","completed"]).maybeSingle();
 if(existingEnrolment)return json(409,{error:"You are already enrolled in this course."});
 let order:any;
 const {data:priorOrder,error:priorOrderError}=await admin.from("orders").select("*").eq("idempotency_key",key).maybeSingle();
 if(priorOrderError)return json(500,{error:"Could not verify the existing order."});
 if(priorOrder){
  if(priorOrder.learner_id!==user.id||priorOrder.course_id!==courseId)return json(409,{error:"Idempotency key already used for a different order."});
  order=priorOrder;
 }else{
  const {data:pendingOrder,error:pendingOrderError}=await admin.from("orders").select("*").eq("learner_id",user.id).eq("course_id",courseId).eq("status","pending").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(pendingOrderError)return json(500,{error:"Could not check for an existing pending order."});
  if(pendingOrder)order=pendingOrder;
  else{
   const {data:created,error}=await admin.from("orders").insert({learner_id:user.id,course_id:courseId,amount_minor:course.price_minor,currency:course.currency,idempotency_key:key}).select("*").single();
   if(error||!created){
    const {data:concurrentOrder,error:retryError}=await admin.from("orders").select("*").eq("learner_id",user.id).eq("course_id",courseId).eq("status","pending").order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(retryError||!concurrentOrder)return json(500,{error:"Could not create or recover the pending payment order."});
    order=concurrentOrder;
   }else order=created;
  }
 }
 if(order.status!=="pending")return json(409,{error:"This order is no longer payable."});
 let payment:any;
 const paymentKey=`payfast:${key}`;
 const {data:priorPayment,error:priorPaymentError}=await admin.from("payment_transactions").select("*").eq("idempotency_key",paymentKey).maybeSingle();
 if(priorPaymentError)return json(500,{error:"Could not verify the existing payment attempt."});
 if(priorPayment){
  if(priorPayment.order_id!==order.id)return json(409,{error:"Payment idempotency key belongs to another order."});
  payment=priorPayment;
 }else{
  const activeStatuses=["initiated","authorized","confirmed","settled"];
  const {data:activePayment,error:activePaymentError}=await admin.from("payment_transactions").select("*").eq("order_id",order.id).in("status",activeStatuses).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(activePaymentError)return json(500,{error:"Could not check for an active payment attempt."});
  if(activePayment)payment=activePayment;
  else{
   const merchantPaymentId=crypto.randomUUID();
   const {data:created,error}=await admin.from("payment_transactions").insert({order_id:order.id,provider:"payfast",merchant_payment_id:merchantPaymentId,idempotency_key:paymentKey,amount_minor:order.amount_minor,currency:order.currency,status:"initiated"}).select("*").single();
   if(error||!created){
    const {data:concurrentPayment,error:retryError}=await admin.from("payment_transactions").select("*").eq("order_id",order.id).in("status",activeStatuses).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(retryError||!concurrentPayment)return json(500,{error:"Could not initialise or recover the payment attempt."});
    payment=concurrentPayment;
   }else payment=created;
  }
 }
 if(payment.status!=="initiated")return json(409,{error:"Payment transaction is no longer awaiting checkout."});
 const profile=await userClient.from("profiles").select("display_name").eq("id",user.id).maybeSingle();
 const successUrl=new URL(returnUrl);successUrl.searchParams.set("payment","return");successUrl.searchParams.set("order_id",order.id);successUrl.searchParams.set("payment_transaction_id",payment.id);
 const abortedUrl=new URL(cancelUrl);abortedUrl.searchParams.set("payment","cancel");abortedUrl.searchParams.set("order_id",order.id);
 const params=new URLSearchParams();
 params.set("merchant_id",merchant);
 params.set("return_url",successUrl.toString());params.set("cancel_url",abortedUrl.toString());params.set("notify_url",notifyUrl);
 params.set("m_payment_id",payment.merchant_payment_id);
 params.set("amount",(Number(order.amount_minor)/100).toFixed(2));
 params.set("item_name",String(course.title).slice(0,100));
 params.set("email_address",user.email??"");
 if(profile.data?.display_name)params.set("name_first",profile.data.display_name.slice(0,100));
 params.set("custom_str1",order.id);params.set("custom_str2",payment.id);
 params.set("signature",signature(params,passphrase));
 const checkoutUrl=`https://sandbox.payfast.co.za/eng/process?${params.toString()}`;
 return json(200,{order_id:order.id,payment_transaction_id:payment.id,checkout_url:checkoutUrl,mode:"sandbox",amount_minor:order.amount_minor,currency:order.currency});
});
