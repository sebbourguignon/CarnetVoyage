import {CARNET_BUILD_SHA,CARNET_BUILD_BRANCH,CARNET_BUILD_CONTEXT,CARNET_BUILD_TIME} from "./carnet-pdf/build.generated.mjs";
import {branchName,expectedProjectRef,netlifyContext} from "./carnet-environment.mjs";
const VERSION="carnet-pdf-v4";
export default async()=>{
  const context=netlifyContext(CARNET_BUILD_CONTEXT);
  const body={buildSha:CARNET_BUILD_SHA,branch:CARNET_BUILD_BRANCH||branchName(),context:CARNET_BUILD_CONTEXT||context,buildTime:CARNET_BUILD_TIME||null,functionVersion:VERSION,supabaseProjectRef:expectedProjectRef(context),netlifyContext:context};
  return new Response(JSON.stringify(body),{headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Carnet-Build":CARNET_BUILD_SHA,"X-Carnet-Function-Version":VERSION}});
};
export const config={path:"/.netlify/functions/carnet-version"};
