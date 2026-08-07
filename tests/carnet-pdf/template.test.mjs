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
  assert.doesNotMatch(html,/standfirst|introduction/);
});

test("une galerie unique accepte sept photographies rectangulaires", () => {
  const photos=Array.from({length:7},(_,i)=>({dataUrl:`data:image/jpeg;base64,${i}`,legende:`Photo ${i+1}`}));
  const html=construireHtml({voyage:{titre:"Voyage"},statistiques:{journeesIllustrees:1,photos:10},journees:[{id:"1",date:"",lieu:"Rome",titre:"Rome",recit:"Récit",tempsForts:[],distance:"",duree:"",photos:photos.slice(0,3),galeries:[photos]}]});
  assert.match(html,/La journée en images/i);assert.match(html,/gallery-7/);
  assert.doesNotMatch(html,/points de vue|border-radius/);
});

test("les étapes compactes sont regroupées et les trajets utilisent un SVG",()=>{
  const jours=Array.from({length:8},(_,i)=>({id:String(i),date:"2026-08-01",lieu:"Route",titre:"Lyon → Turin",recit:"",tempsForts:[],distance:"100 km",duree:"2 h",photos:[],compacte:true}));
  const html=construireHtml({voyage:{titre:"Voyage"},statistiques:{journeesIllustrees:0,photos:0},journees:jours});
  assert.equal((html.match(/class="sheet compact-page"/g)||[]).length,2);assert.match(html,/route-arrow/);assert.doesNotMatch(html,/Lyon → Turin/);
});

test("un récit long crée des pages de continuation sans perdre le texte",()=>{
  const recit=Array.from({length:900},(_,i)=>`mot${i}`).join(" ");
  const html=construireHtml({voyage:{titre:"Long voyage"},statistiques:{journeesIllustrees:0,photos:0},journees:[{id:"1",date:"",lieu:"Paris",titre:"Paris",introduction:"Intro",recit,tempsForts:[],distance:"",duree:"",photos:[],galeries:[]}]});
  assert.ok((html.match(/class="sheet/g)||[]).length>3);
  assert.match(html,/mot0/); assert.match(html,/mot899/);
});
