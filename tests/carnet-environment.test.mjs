import test from "node:test";
import assert from "node:assert/strict";
import {DEV_URL,PROD_URL,environmentMismatchResponse} from "../netlify/functions/carnet-environment.mjs";

test("un preview refuse une écriture vers Supabase PROD",async()=>{
  const precedent=process.env.CONTEXT;
  process.env.CONTEXT="branch-deploy";
  try{
    const reponse=environmentMismatchResponse(PROD_URL);
    assert.equal(reponse.status,403);
    assert.equal((await reponse.json()).code,"PREVIEW_PROD_WRITE_BLOCKED");
    assert.equal(environmentMismatchResponse(DEV_URL),null);
  }finally{
    if(precedent===undefined)delete process.env.CONTEXT;else process.env.CONTEXT=precedent;
  }
});
