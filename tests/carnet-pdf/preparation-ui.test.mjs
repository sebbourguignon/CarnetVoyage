import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

test("parcours de préparation du carnet",{skip:process.env.CARNET_PREPARATION_UI_TEST!=="1",timeout:120000},async()=>{
  const navigateur=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH,headless:true,args:["--no-sandbox"]});
  try{
    const page=await navigateur.newPage();
    await page.setViewport({width:1100,height:900,deviceScaleFactor:1});
    await page.goto(pathToFileURL(resolve("tests/fixtures/carnet-preparation.html")).href,{waitUntil:"networkidle0"});
    assert.equal(await page.$eval(".carnet-preparation-stat:last-child span",el=>el.textContent),"photos sélectionnées");
    assert.ok(!(await page.$eval(".carnet-preparation-stats",el=>el.textContent)).includes("/ 20"));
    await page.click(".carnet-bouton-generer");
    assert.equal(await page.$eval(".carnet-source",el=>el.textContent),"Ancien texte à relire");
    assert.equal(await page.$eval(".carnet-brouillon",el=>el.textContent),"Brouillon");
    assert.equal(await page.$eval(".carnet-programme-option input",el=>el.checked),false);
    const suggestion=await page.$$eval(".carnet-fait-confirmation input",els=>els.map(el=>el.checked));
    assert.deepEqual(suggestion,[false,false,false]);
    for(let i=1;i<13;i++){
      const selecteur=`.carnet-selection-photo:nth-child(${i+1}) .carnet-photo-choisir input`;
      await page.click(selecteur);
    }
    assert.match(await page.$eval(".carnet-photos-compteur",el=>el.textContent),/^13 sélectionnées/);
    assert.ok(await page.$eval(".carnet-photos-compteur",el=>el.classList.contains("avertissement")));
    await page.screenshot({path:process.env.CARNET_PREPARATION_CAPTURE||"/tmp/carnet-preparation-lot2.png",fullPage:true});
  } finally { await navigateur.close(); }
});

