import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"GET,POST,OPTIONS"
};

export const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{...cors,"content-type":"application/json; charset=utf-8"}
});

export function serviceClient(){
  return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
}

export async function requireUser(req:Request){
  const auth=req.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer ")) throw new Error("Não autenticado");
  const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{
    global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data,error}=await client.auth.getUser();
  if(error||!data.user) throw new Error("Sessão inválida ou expirada");
  return {user:data.user,client};
}

function hexToBytes(hex:string){
  if(!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("WHATSAPP_TOKEN_ENCRYPTION_KEY inválida: use 64 caracteres hexadecimais");
  return new Uint8Array(hex.match(/.{2}/g)!.map(x=>parseInt(x,16)));
}

async function cryptoKey(){
  const secret=(Deno.env.get("WHATSAPP_TOKEN_ENCRYPTION_KEY")||"").trim();
  if(!secret) throw new Error("WHATSAPP_TOKEN_ENCRYPTION_KEY não configurada no Supabase Secrets");
  return crypto.subtle.importKey("raw",hexToBytes(secret),{name:"AES-GCM"},false,["encrypt","decrypt"]);
}

function toB64(bytes:Uint8Array){
  let s=""; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s);
}
function fromB64(s:string){
  const raw=atob(s); const out=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i); return out;
}

export async function encryptSecret(value:string){
  const key=await cryptoKey();
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=new TextEncoder().encode(value);
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,data));
  const packed=new Uint8Array(iv.length+encrypted.length); packed.set(iv); packed.set(encrypted,iv.length);
  return toB64(packed);
}

export async function decryptSecret(packedB64:string){
  const key=await cryptoKey();
  const packed=fromB64(packedB64); const iv=packed.slice(0,12); const encrypted=packed.slice(12);
  const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv},key,encrypted);
  return new TextDecoder().decode(clear);
}

export const digits=(v:unknown)=>String(v??"").replace(/\D/g,"");
export const graphVersion=()=>Deno.env.get("META_GRAPH_VERSION")||"v25.0";

export async function graphFetch(path:string,token:string,init:RequestInit={}){
  const version=graphVersion();
  const url=`https://graph.facebook.com/${version}/${path.replace(/^\//,'')}`;
  const headers=new Headers(init.headers||{});
  headers.set("Authorization",`Bearer ${token}`);
  if(init.body&&!headers.has("content-type"))headers.set("content-type","application/json");
  return fetch(url,{...init,headers});
}
