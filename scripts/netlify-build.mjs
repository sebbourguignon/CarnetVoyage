import {readFile, writeFile} from "node:fs/promises";

const root=new URL("..",import.meta.url);
const indexPath=new URL("app/index.html",root);
const buildInfoPath=new URL("app/build-info.json",root);
const functionBuildPath=new URL("netlify/functions/carnet-pdf/build.generated.mjs",root);

export function buildMetadata(env=process.env){
  return {
    sha:env.COMMIT_REF||env.COMMIT_SHA||"unknown",
    branch:env.BRANCH||env.HEAD||"unknown",
    context:env.CONTEXT||"local",
    buildTime:new Date().toISOString()
  };
}

export function buildOutputs(build){
  const frontend=`window.__carnetBuild = ${JSON.stringify(build)};`;
  const info={...build,buildSha:build.sha,clientVersion:"carnet-client-v4"};
  const functionModule=[
    `export const CARNET_BUILD_SHA=${JSON.stringify(build.sha)};`,
    `export const CARNET_BUILD_BRANCH=${JSON.stringify(build.branch)};`,
    `export const CARNET_BUILD_CONTEXT=${JSON.stringify(build.context)};`,
    `export const CARNET_BUILD_TIME=${JSON.stringify(build.buildTime)};`,
    ""
  ].join("\n");
  return {frontend,buildInfo:JSON.stringify(info)+"\n",functionModule};
}

const build=buildMetadata();
const outputs=buildOutputs(build);
const marker=/window\.__carnetBuild\s*=\s*\{[^;]+\};/;
const source=await readFile(indexPath,"utf8");
if(!marker.test(source))throw new Error("Marqueur __carnetBuild introuvable");

const writeEnabled=process.env.CARNET_BUILD_WRITE==="1"||process.env.NETLIFY==="true"||process.env.CI==="true";
if(writeEnabled){
  await writeFile(indexPath,source.replace(marker,outputs.frontend));
  await writeFile(buildInfoPath,outputs.buildInfo);
  await writeFile(functionBuildPath,outputs.functionModule);
}else{
  console.log(JSON.stringify({mode:"dry-run",...build}));
}
