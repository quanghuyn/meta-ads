// Private staging receiver, never logs request body or authentication values.
import { createClient } from 'jsr:@supabase/supabase-js@2';
Deno.serve(async (req: Request) => {
 const reply = (b: unknown, status=200) => new Response(JSON.stringify(b),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 if(req.method!=='POST') return reply({error:'method_not_allowed'},405);
 const expected=Deno.env.get('META_WEBHOOK_TOKEN_SHA256') || '573b723b1fbdd7260624c0386e5296c4aebca8db1266c3a118a5c811d1f87981';
 if(!expected) return reply({error:'not_configured'},503);
 const token=req.headers.get('x-webhook-key') || new URL(req.url).searchParams.get('key') || '';
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 let mismatch=digest.length ^ expected.length;
 for(let i=0;i<expected.length;i++) mismatch|=expected.charCodeAt(i)^digest.charCodeAt(i);
 if(!token || mismatch) return reply({error:'unauthorized'},401);
 const limit=1048576;
 if(Number(req.headers.get('content-length')||0)>limit) return reply({error:'payload_too_large'},413);
 const chunks: Uint8Array[]=[];let size=0;const reader=req.body?.getReader();
 try {if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return reply({error:'payload_too_large'},413);}chunks.push(value);}}catch{return reply({error:'body_read_failed'},400);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let payload: unknown;try{payload=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply({error:'invalid_json'},400);}
 if(!payload || typeof payload!=='object')return reply({error:'expected_json_object_or_array'},400);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data,error}=await db.from('meta_webhook_inbox').insert({payload,payload_bytes:size}).select('id').single();
 if(error)return reply({error:'storage_failed'},500);
 return reply({ok:true,receipt_id:data.id,status:'pending_mapping',report_updated:false},202);
});
