import test from "node:test";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import puppeteer from "puppeteer-core";

const captureDir=process.env.CARNET_PREPARATION_CAPTURE_DIR;
async function capture(page,name){if(captureDir){await mkdir(captureDir,{recursive:true});await page.screenshot({path:resolve(captureDir,name),fullPage:true});}}

test("dashboard et parcours dédié de préparation avec 77 photos",{skip:process.env.CARNET_PREPARATION_UI_TEST!=="1",timeout:120000},async()=>{
  const browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH,headless:true,args:["--no-sandbox"]});
  try{
    const page=await browser.newPage();await page.setViewport({width:1100,height:900});
    page.on("dialog",d=>d.accept());
    await page.goto(pathToFileURL(resolve("tests/fixtures/carnet-preparation.html")).href,{waitUntil:"networkidle0"});

    assert.equal(await page.$$(".carnet-preparation-intro").then(x=>x.length),0);
    assert.match(await page.$eval(".carnet-dashboard-progression",n=>n.textContent),/1 prête · 1 en cours · 22 à préparer/);
    assert.equal(await page.$$eval(".carnet-dashboard-jour",ns=>ns.length),24);
    assert.match(await page.$eval(".carnet-dashboard-continuer",n=>n.textContent),/Modène & la Motor Valley/);
    assert.match(await page.$eval(".carnet-dashboard-generation .carnet-bouton-generer",n=>n.textContent),/1 journée/);
    await capture(page,"dashboard-desktop.png");

    await page.click('.carnet-dashboard-filtres button:nth-child(1)');
    assert.equal(await page.$$eval(".carnet-dashboard-jour",ns=>ns.length),22);
    await page.click('.carnet-dashboard-filtres button:nth-child(4)');
    await page.click(".carnet-dashboard-continuer button");
    await page.waitForSelector(".carnet-vue-journee");
    assert.equal(await page.$$eval(".carnet-dashboard-jour",ns=>ns.length),0);
    assert.match(await page.$eval(".carnet-journee-titre",n=>n.textContent),/Modène & la Motor Valley/);
    assert.match(await page.$eval(".carnet-photos-compteur",n=>n.textContent),/^77 photos dans la journée · 1 \/ 10/);
    assert.equal(await page.$$eval(".carnet-selection-photo",ns=>ns.length),1);
    assert.equal(await page.$$(".carnet-sauvegarde").then(x=>x.length),0);
    assert.equal(await page.$eval(".carnet-preparation-notes",n=>getComputedStyle(n).resize),"none");

    const activites=await page.$$eval(".carnet-activite .carnet-fait-confirmation span",ns=>ns.map(n=>n.textContent));
    assert.equal(activites.filter(x=>/Ghirlandina/.test(x)).length,1);
    assert.ok(await page.$eval(".carnet-activite-details",n=>/Wiligelmo/.test(n.textContent)&&/Pescheria/.test(n.textContent)));
    await page.click(".carnet-fait-confirmation input");
    await page.waitForSelector(".carnet-moment-ligne");
    await page.click(".carnet-preparation-actions .carnet-action-primaire");
    await page.waitForFunction(()=>document.querySelector(".carnet-preparation-recit")?.value.length>100);
    const payload=await page.evaluate(()=>window.DERNIER_PAYLOAD_IA);
    assert.equal(payload.faits_confirmes.length,1);
    assert.ok(!JSON.stringify(payload).includes("Si vous avez plus de temps"));

    const buttons=await page.$$("button");for(const b of buttons){if(await b.evaluate(n=>n.textContent)==="Modifier la sélection"){await b.click();break;}}
    await page.waitForSelector(".carnet-photo-modal");
    assert.equal(await page.$$eval(".carnet-photo-pick",ns=>ns.length),77);
    for(let i=0;i<9;i++)await page.evaluate(()=>document.querySelector(".carnet-photo-pick:not(.active)").click());
    assert.equal(await page.$eval(".carnet-photo-dialog header strong",n=>n.textContent),"10 / 10");
    await page.click(".carnet-photo-pick:not(.active)");
    assert.equal(await page.$eval(".carnet-photo-dialog header strong",n=>n.textContent),"10 / 10");
    await page.click(".carnet-photo-filtre input");assert.equal(await page.$$eval(".carnet-photo-pick",ns=>ns.length),10);
    await page.click(".carnet-photo-dialog footer .carnet-action-primaire");
    assert.equal(await page.$$eval(".carnet-selection-photo",ns=>ns.length),10);
    await capture(page,"journee-desktop.png");

    await page.setViewport({width:390,height:844});
    const barre=await page.$eval(".carnet-action-bar",n=>{const r=n.getBoundingClientRect();return{left:r.left,right:r.right,bottom:r.bottom};});
    assert.ok(barre.left>=0&&barre.right<=390&&barre.bottom<=844);
    for(const selector of [".carnet-action-bar .carnet-action-primaire",".carnet-journee-navigation button"]){const tailles=await page.$$eval(selector,ns=>ns.map(n=>{const r=n.getBoundingClientRect();return{w:r.width,h:r.height};}));assert.ok(tailles.every(x=>x.h>=44));}
    await capture(page,"journee-mobile.png");
    await page.waitForFunction(()=>document.querySelector(".carnet-autosave-statut")?.textContent==="Modifications enregistrées");
    await page.evaluate(()=>{window.LATENCE_BDD=80;const b=document.querySelector(".carnet-action-bar .carnet-action-primaire");b.click();b.click();});
    await page.waitForFunction(()=>/Journée au bord du lac/.test(document.querySelector(".carnet-journee-titre")?.textContent||""));
    assert.equal(await page.evaluate(()=>window.APPELS_BDD.filter(x=>x.table==="carnet_journees"&&x.action==="update"&&x.payload.carnet_terminee===true).length),1);
    await page.$eval(".carnet-preparation-notes",n=>{n.value="Un nouveau souvenir";n.dispatchEvent(new Event("input",{bubbles:true}));});
    assert.equal(await page.$eval("[data-day-status]",n=>n.textContent),"En cours");
    await page.click(".carnet-action-bar .carnet-action-texte");
    await page.waitForSelector(".carnet-dashboard-liste");
    await capture(page,"dashboard-mobile.png");

    for(const largeur of [375,390,430]){await page.setViewport({width:largeur,height:844});const debordement=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(debordement<=1,`débordement horizontal à ${largeur}px`);}

    const sansPrete=await browser.newPage();await sansPrete.setViewport({width:390,height:844});
    await sansPrete.goto(pathToFileURL(resolve("tests/fixtures/carnet-preparation.html")).href+"?sans-prete",{waitUntil:"networkidle0"});
    assert.equal(await sansPrete.$eval(".carnet-dashboard-generation .carnet-bouton-generer",n=>n.disabled),true);
    assert.match(await sansPrete.$eval(".carnet-dashboard-generation",n=>n.textContent),/Terminez au moins une journée/);
    await sansPrete.close();
  }finally{await browser.close();}
});
