import {CARNET_BUILD_SHA} from "./carnet-pdf/build.generated.mjs";
const VERSION="carnet-pdf-v4";
export default async()=>new Response(JSON.stringify({buildSha:CARNET_BUILD_SHA,functionVersion:VERSION}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Carnet-Build":CARNET_BUILD_SHA,"X-Carnet-Function-Version":VERSION}});
export const config={path:"/.netlify/functions/carnet-version"};
