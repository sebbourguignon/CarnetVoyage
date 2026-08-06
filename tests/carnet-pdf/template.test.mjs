import test from "node:test";
import assert from "node:assert/strict";
import { construireHtml } from "../../netlify/functions/carnet-pdf/template.mjs";

test("le template échappe les textes, garde les accents et omet les blocs absents", () => {
  const html=construireHtml({
    voyage:{titre:"L’été d’Anaïs <script>",dateDebut:"2026-08-01",dateFin:"2026-08-02"},
    statistiques:{journeesIllustrees:0,photos:0},
    journees:[{id:"1",date:"2026-08-01",lieu:"Nîmes",titre:"Nîmes & Arles",introduction:"",recit:"C’était l’été.",tempsForts:[],distance:"",duree:"",photos:[],galeries:[]}]
  });
  assert.match(html,/L’été d’Anaïs &lt;script&gt;/);
  assert.match(html,/Nîmes &amp; Arles/);
  assert.doesNotMatch(html,/undefined|null/);
  assert.equal((html.match(/class="sheet/g)||[]).length,3);
});

test("une galerie de cinq photographies conserve les cinq emplacements asymétriques", () => {
  const photos=Array.from({length:5},(_,i)=>({dataUrl:`data:image/jpeg;base64,${i}`,legende:`Photo ${i+1}`}));
  const html=construireHtml({voyage:{titre:"Voyage"},statistiques:{journeesIllustrees:1,photos:5},journees:[{id:"1",date:"",lieu:"Rome",titre:"Rome",introduction:"",recit:"Récit",tempsForts:[],distance:"",duree:"",photos:photos.slice(0,3),galeries:[photos]}]});
  for(const classe of ["gallery-a","gallery-b","gallery-c","gallery-d","gallery-e"]) assert.match(html,new RegExp(classe));
});

test("un récit long crée des pages de continuation sans perdre le texte",()=>{
  const recit=Array.from({length:900},(_,i)=>`mot${i}`).join(" ");
  const html=construireHtml({voyage:{titre:"Long voyage"},statistiques:{journeesIllustrees:0,photos:0},journees:[{id:"1",date:"",lieu:"Paris",titre:"Paris",introduction:"Intro",recit,tempsForts:[],distance:"",duree:"",photos:[],galeries:[]}]});
  assert.ok((html.match(/class="sheet/g)||[]).length>3);
  assert.match(html,/mot0/); assert.match(html,/mot899/);
});
