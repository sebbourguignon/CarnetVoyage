import test from "node:test";
import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import puppeteer from "puppeteer-core";

test("parcours ergonomique de préparation avec 77 photos",{skip:process.env.CARNET_PREPARATION_UI_TEST!=="1",timeout:120000},async()=>{
  const browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH,headless:true,args:["--no-sandbox"]});
  try{
    const page=await browser.newPage();await page.setViewport({width:1100,height:900});
    page.on("dialog",d=>d.accept());
    await page.goto(pathToFileURL(resolve("tests/fixtures/carnet-preparation.html")).href,{waitUntil:"networkidle0"});
    await page.click(".carnet-bouton-generer");
    await page.waitForSelector(".carnet-preparation-jour-head");
    assert.match(await page.$eval(".carnet-preparation-jour-head",n=>n.textContent),/Modène & la Motor Valley/);
    const activites=await page.$$eval(".carnet-activite .carnet-fait-confirmation span",ns=>ns.map(n=>n.textContent));
    assert.equal(activites.filter(x=>/Ghirlandina/.test(x)).length,1);
    assert.ok(await page.$eval(".carnet-activite-details",n=>/Wiligelmo/.test(n.textContent)&&/Pescheria/.test(n.textContent)));
    assert.match(await page.$eval(".carnet-photos-compteur",n=>n.textContent),/^77 photos dans la journée · 1 \/ 10/);
    assert.equal(await page.$$eval(".carnet-selection-photo",ns=>ns.length),1);
    assert.equal(await page.$$(".carnet-sauvegarde").then(x=>x.length),0);
    assert.equal(await page.$$(".carnet-valide").then(x=>x.length),0);
    assert.equal(await page.$eval(".carnet-preparation-notes",n=>getComputedStyle(n).resize),"none");

    await page.click(".carnet-fait-confirmation input");
    await page.waitForSelector(".carnet-moment-ligne");
    await page.click(".carnet-preparation-actions .carnet-action-primaire");
    await page.waitForFunction(()=>document.querySelector(".carnet-preparation-recit")?.value.length>100);
    const payload=await page.evaluate(()=>window.DERNIER_PAYLOAD_IA);
    assert.equal(payload.faits_confirmes.length,1);
    assert.ok(!JSON.stringify(payload).includes("Si vous avez plus de temps"));
    await page.$eval(".carnet-preparation-bloc textarea:not(.carnet-preparation-recit)",n=>{n.value="Une nouvelle anecdote";n.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.waitForSelector(".carnet-recit-obsolete");
    await page.click(".carnet-preparation-actions .carnet-action-secondaire");
    assert.equal(await page.$eval(".carnet-preparation-recit",n=>n.value),"Une ancienne proposition à relire avant de devenir notre souvenir.");

    await page.click(".carnet-preparation-bloc:nth-of-type(3) > .carnet-action-secondaire").catch(async()=>{
      const buttons=await page.$$("button");for(const b of buttons){if(await b.evaluate(n=>n.textContent)==="Modifier la sélection"){await b.click();break;}}
    });
    await page.waitForSelector(".carnet-photo-modal");
    assert.equal(await page.$$eval(".carnet-photo-pick",ns=>ns.length),77);
    for(let i=0;i<9;i++)await page.evaluate(()=>document.querySelector(".carnet-photo-pick:not(.active)").click());
    assert.equal(await page.$eval(".carnet-photo-dialog header strong",n=>n.textContent),"10 / 10");
    await page.click(".carnet-photo-pick:not(.active)");
    assert.equal(await page.$eval(".carnet-photo-dialog header strong",n=>n.textContent),"10 / 10");
    await page.click(".carnet-photo-filtre input");assert.equal(await page.$$eval(".carnet-photo-pick",ns=>ns.length),10);
    await page.click(".carnet-photo-dialog footer .carnet-action-primaire");
    assert.equal(await page.$$eval(".carnet-selection-photo",ns=>ns.length),10);
    assert.ok(await page.$(".carnet-action-bar"));
    await page.waitForFunction(()=>document.querySelector(".carnet-autosave-statut")?.textContent==="Modifications enregistrées");
    await page.evaluate(()=>{window.LATENCE_BDD=80;const b=document.querySelector(".carnet-action-bar .carnet-action-primaire");b.click();b.click();});
    await page.waitForFunction(()=>document.querySelector(".carnet-preparation-jour-head>span:last-child")?.textContent==="Prête");
    assert.equal(await page.evaluate(()=>window.APPELS_BDD.filter(x=>x.table==="carnet_journees"&&x.action==="upsert"&&x.payload.carnet_terminee===true).length),1);
    assert.equal(await page.evaluate(()=>window.APPELS_BDD.some(x=>x.table==="carnet_textes")),false);
    await page.click(".carnet-preparation-jour-head");
    await page.$eval(".carnet-preparation-bloc textarea:not(.carnet-preparation-recit)",n=>{n.value+=" modifiée";n.dispatchEvent(new Event("input",{bubbles:true}));});
    assert.equal(await page.$eval(".carnet-preparation-jour.ouvert .carnet-preparation-jour-head>span:last-child",n=>n.textContent),"Brouillon");
    await page.evaluate(()=>{window.ECHEC_FINALISATION=true;window.LATENCE_BDD=0;document.querySelector(".carnet-action-bar .carnet-action-primaire").click();});
    await page.waitForFunction(()=>document.querySelector(".carnet-autosave-statut")?.textContent.includes("Réessayer"));
    assert.match(await page.$eval(".carnet-preparation-recit",n=>n.value),/ancienne proposition/);
    await page.click(".carnet-autosave-statut");
    await page.waitForFunction(()=>document.querySelector(".carnet-preparation-jour-head>span:last-child")?.textContent==="Prête");
    await page.waitForSelector(".carnet-preparation-jour.ouvert .carnet-action-bar");
    await page.click(".carnet-preparation-jour.ouvert .carnet-action-bar .carnet-action-primaire");
    await page.waitForFunction(()=>document.querySelectorAll(".carnet-preparation-jour-head>span:last-child")[1]?.textContent==="Prête");
    await page.setViewport({width:390,height:844});
    await page.waitForSelector(".carnet-preparation-jour.ouvert .carnet-action-bar");
    const barre=await page.$eval(".carnet-preparation-jour.ouvert .carnet-action-bar",n=>{const r=n.getBoundingClientRect();return{left:r.left,right:r.right,bottom:r.bottom};});
    assert.ok(barre.left>=0&&barre.right<=390&&barre.bottom<=844);
    if(process.env.CARNET_PREPARATION_CAPTURE)await page.screenshot({path:process.env.CARNET_PREPARATION_CAPTURE,fullPage:true});
  }finally{await browser.close();}
});
