export const DEV_URL="https://ozjbkpgoatagqyrlxdry.supabase.co";
export const PROD_URL="https://cgxnrgkalhfyfkpesshq.supabase.co";
export const DEV_REF="ozjbkpgoatagqyrlxdry";
export const PROD_REF="cgxnrgkalhfyfkpesshq";

export function netlifyContext(){return process.env.CONTEXT||"unknown";}
export function expectedProjectUrl(context=netlifyContext()){
  return context==="production"?PROD_URL:DEV_URL;
}
export function projectRefFromUrl(url){
  if(url===DEV_URL)return DEV_REF;
  if(url===PROD_URL)return PROD_REF;
  return "unknown";
}
export function expectedProjectRef(context=netlifyContext()){
  return projectRefFromUrl(expectedProjectUrl(context));
}
export function branchName(){return process.env.BRANCH||process.env.HEAD||"unknown";}

export function environmentMismatchResponse(requestedUrl){
  const expected=expectedProjectUrl();
  if(requestedUrl===expected)return null;
  const code=requestedUrl===PROD_URL&&netlifyContext()!=="production"
    ?"PREVIEW_PROD_WRITE_BLOCKED"
    :"SUPABASE_ENVIRONMENT_MISMATCH";
  return new Response(JSON.stringify({code,expectedProjectRef:projectRefFromUrl(expected)}),{
    status:403,
    headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
  });
}
