import test from "node:test";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import puppeteer from "puppeteer-core";

const captureDir=process.env.CARNET_PREPARATION_CAPTURE_DIR;
async function capture(page,name){if(captureDir){await mkdir(captureDir,{recursive:true});await page.screenshot({path:resolve(captureDir,name),fullPage:true});}}

test("dashboard et parcours dédié de préparation avec 30 photos",{skip:process.env.CARNET_PREPARATION_UI_TEST!=="1",timeout:120000},async()=>{
  const browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH,headless:true,args:["--no-sandbox"]});
  try{
    const page=await browser.newPage();await page.setViewport({width:1100,height:900});
    page.on("dialog",d=>d.accept());
    await page.goto(pathToFileURL(resolve("tests/fixtures/carnet-preparation.html")).href,{waitUntil:"networkidle0"});

    assert.equal(await page.$$(".carnet-preparation-intro").then(x=>x.length),0);
    assert.match(await page.$eval(".carnet-dashboard-generation",n=>n.textContent),/1 journée prête sur 24/);
    assert.deepEqual(await page.$eval(".carnet-dashboard-barre",n=>({now:n.getAttribute("aria-valuenow"),max:n.getAttribute("aria-valuemax")})),{now:"1",max:"24"});
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
    assert.deepEqual(await page.$$eval(".carnet-etape-numero",ns=>ns.map(n=>n.textContent)),["01 —","02 —","03 —","04 —","05 —"]);
    assert.equal(await page.$$(".carnet-journee-navigation").then(x=>x.length),0);
    assert.equal(await page.$$(".carnet-detail-day-navigation").then(x=>x.length),0);
    assert.equal(await page.$$("#day-nav-sticky .day-nav-sticky-link").then(x=>x.length),2);
    assert.equal(await page.$eval("[data-save-day]",n=>n.hidden),true);
    const sectionHeadings=await page.$$eval(".section-heading",ns=>ns.map(n=>({display:getComputedStyle(n).display,align:getComputedStyle(n).alignItems,numero:n.querySelector(".carnet-etape-numero")?.textContent,titre:n.querySelector("h4")?.textContent})));
    assert.equal(sectionHeadings.length,5);
    assert.ok(sectionHeadings.every(x=>x.display==="flex"&&x.align==="baseline"),JSON.stringify(sectionHeadings));
    assert.equal(await page.$$(".carnet-options-journee").then(x=>x.length),0);
    assert.equal(await page.$eval(".carnet-preparation-bloc:nth-of-type(4) h4",n=>n.textContent),"Notes & souvenirs");
    assert.match(await page.$eval(".carnet-photos-compteur",n=>n.textContent),/^30 \/ 30 photos dans la journée · 1 \/ 10/);
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
    assert.equal(await page.$$eval(".carnet-photo-pick",ns=>ns.length),30);
    for(let i=0;i<9;i++)await page.evaluate(()=>document.querySelector(".carnet-photo-pick:not(.active)").click());
    assert.equal(await page.$eval(".carnet-photo-dialog header strong",n=>n.textContent),"10 / 10");
    await page.click(".carnet-photo-pick:not(.active)");
    assert.equal(await page.$eval(".carnet-photo-dialog header strong",n=>n.textContent),"10 / 10");
    await page.click(".carnet-photo-filtre input");assert.equal(await page.$$eval(".carnet-photo-pick",ns=>ns.length),10);
    await page.click(".carnet-photo-dialog footer .carnet-action-primaire");
    assert.equal(await page.$$eval(".carnet-selection-photo",ns=>ns.length),10);
    await capture(page,"journee-desktop.png");

    await page.setViewport({width:390,height:844});
    assert.equal(await page.$$(".carnet-action-bar").then(x=>x.length),0);
    const barre=await page.$eval("#day-nav-sticky",n=>{const r=n.getBoundingClientRect();return{left:r.left,right:r.right,bottom:r.bottom};});
    assert.ok(barre.left>=0&&barre.right<=390&&barre.bottom<=844);
    assert.equal(await page.$$eval("#day-nav-sticky [data-finish-day]",ns=>ns.length),1);
    for(const selector of ["#day-nav-sticky [data-finish-day]","#day-nav-sticky .day-nav-sticky-link"]){const tailles=await page.$$eval(selector,ns=>ns.map(n=>{const r=n.getBoundingClientRect();return{w:r.width,h:r.height};}));assert.ok(tailles.every(x=>x.h>=34));}
    await capture(page,"journee-mobile.png");
    assert.equal(await page.$eval(".carnet-autosave-statut",n=>n.hidden),true);
    await page.focus(".carnet-preparation-notes");
    assert.equal(await page.$eval(".footer-stack",n=>getComputedStyle(n).position),"fixed");
    await page.evaluate(()=>document.activeElement.blur());
    await page.evaluate(()=>{window.LATENCE_BDD=80;const b=document.querySelector("#day-nav-sticky [data-finish-day]");b.click();b.click();});
    await page.waitForFunction(()=>/Journée au bord du lac/.test(document.querySelector(".carnet-journee-titre")?.textContent||""));
    assert.equal(await page.evaluate(()=>window.APPELS_BDD.filter(x=>x.table==="carnet_journees"&&x.action==="update"&&x.payload.carnet_terminee===true).length),1);
    assert.deepEqual(await page.$eval("#day-nav-sticky [data-finish-day]",n=>({texte:n.textContent,disabled:n.disabled})),{texte:"✓ Prête",disabled:true});
    await page.$eval(".carnet-preparation-notes",n=>{n.value="Un nouveau souvenir";n.dispatchEvent(new Event("input",{bubbles:true}));});
    assert.equal(await page.$eval("[data-day-status]",n=>n.textContent),"En cours");
    assert.deepEqual(await page.$eval("#day-nav-sticky [data-finish-day]",n=>({texte:n.querySelector(".carnet-action-court")?.textContent||n.textContent,disabled:n.disabled})),{texte:"Terminer",disabled:false});
    await page.click(".carnet-journee-entete .carnet-action-texte");
    await page.waitForSelector(".carnet-dashboard-liste");
    await capture(page,"dashboard-mobile.png");

    for(const largeur of [375,390,430]){await page.setViewport({width:largeur,height:844});const debordement=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(debordement<=1,`débordement horizontal à ${largeur}px`);}

    const sansPrete=await browser.newPage();await sansPrete.setViewport({width:390,height:844});
    await sansPrete.goto(pathToFileURL(resolve("tests/fixtures/carnet-preparation.html")).href+"?sans-prete",{waitUntil:"networkidle0"});
    assert.equal(await sansPrete.$eval(".carnet-dashboard-generation .carnet-bouton-generer",n=>n.disabled),true);
    assert.match(await sansPrete.$eval(".carnet-dashboard-generation",n=>n.textContent),/Terminez au moins une journée/);
    await sansPrete.close();

    const rehydrate=await browser.newPage();await rehydrate.setViewport({width:390,height:844});
    await rehydrate.goto(pathToFileURL(resolve("tests/fixtures/carnet-preparation.html")).href+"?rehydrate",{waitUntil:"networkidle0"});
    await rehydrate.click(".carnet-dashboard-continuer button");await rehydrate.waitForSelector(".carnet-vue-journee");
    assert.equal(await rehydrate.$$eval(".carnet-fait-confirmation input:checked",ns=>ns.length),2);
    assert.equal(await rehydrate.$$eval(".carnet-options-journee",ns=>ns.length),0);
    await rehydrate.close();
  }finally{await browser.close();}
});
