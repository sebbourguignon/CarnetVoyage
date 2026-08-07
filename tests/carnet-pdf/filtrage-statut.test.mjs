import test from "node:test";
import assert from "node:assert/strict";
import {filtrerModeleTermine} from "../../netlify/functions/generer-carnet.mjs";
import {verifierJourneesTerminees} from "../../netlify/functions/carnet-pdf/template.mjs";

const jour=(id,photos=[])=>({id,titre:id,photos});
const agenda=Array.from({length:24},(_,i)=>({id:i===0?"verone":i===1?"modene":`brouillon-${i}`}));
function filtrer(pretes){const modele={journees:[jour("verone",Array(4).fill({id:"v"})),jour("modene",Array(10).fill({id:"m"})),...agenda.slice(2).map(x=>jour(x.id))]};const diagnostic=filtrerModeleTermine(modele,pretes.map(journee_id=>({journee_id,carnet_terminee:true})),agenda);return{modele,diagnostic};}

test("A — Vérone et Modène prêtes donnent exclusivement 2 journées et 14 photos",()=>{const {modele,diagnostic}=filtrer(["verone","modene"]);assert.deepEqual(diagnostic.includedDayIds,["verone","modene"]);assert.equal(diagnostic.excludedDayIds.length,22);assert.equal(modele.statistiques.photos,14);assert.doesNotThrow(()=>verifierJourneesTerminees(modele));});
test("B/C — le passage Brouillon puis Prête retire et réintègre Vérone",()=>{assert.deepEqual(filtrer(["modene"]).diagnostic.includedDayIds,["modene"]);assert.deepEqual(filtrer(["verone","modene"]).diagnostic.includedDayIds,["verone","modene"]);});
test("D — toutes les journées Brouillon produisent un modèle vide",()=>{const {modele}=filtrer([]);assert.equal(modele.journees.length,0);assert.equal(modele.statistiques.photos,0);});
test("E — une journée Prête sans photo reste incluse seule",()=>{const modele={journees:[jour("vide"),jour("draft",[{id:"interdite"}])]};const diagnostic=filtrerModeleTermine(modele,[{journee_id:"vide",carnet_terminee:true}],[{id:"vide"},{id:"draft"}]);assert.deepEqual(diagnostic.includedDayIds,["vide"]);assert.equal(modele.statistiques.photos,0);});
test("la garde refuse explicitement un brouillon arrivé au template",()=>{assert.throws(()=>verifierJourneesTerminees({journees:[{id:"draft",carnetTerminee:false}]}),e=>e.code==="BROUILLON_DANS_TEMPLATE");});
