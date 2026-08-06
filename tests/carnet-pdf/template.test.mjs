import test from "node:test";
import assert from "node:assert/strict";
import { construireHtml } from "../../netlify/functions/carnet-pdf/template.mjs";

test("le template échappe les textes, garde les accents et omet les blocs absents", () => {
  const html=construireHtml({
    voyage:{titre:"L’été d’Anaïs <script>",dateDebut:"2026-08-01",dateFin:"2026-08-02"},
    statistiques:{journeesIllustrees:0,photos:0},
    journees:[{id:"1",date:"2026-08-01",lieu:"Nîmes",titre:"Nîmes & Arles",recit:"C’était l’été.",tempsForts:[],distance:"",duree:"",temperature:"",photos:[],galeries:[],compacte:false}]
  });
  assert.match(html,/L’été d’Anaïs &lt;script&gt;/);
  assert.match(html,/Nîmes &amp; Arles/);
  assert.doesNotMatch(html,/undefined|null/);
  assert.equal((html.match(/class="sheet/g)||[]).length,3);
});

test("les variantes de une à quatre photos et les galeries de six sont explicites", () => {
  const photo=n=>({dataUrl:`data:image/jpeg;base64,${n}`,legende:`Photo ${n}`});
  const jours=[1,2,3,4].map(n=>({id:String(n),date:"",lieu:"Rome",titre:"Rome",recit:"Récit",tempsForts:[],distance:"",duree:"",photos:Array.from({length:n},(_,i)=>photo(`${n}-${i}`)),galeries:[],compacte:false}));
  jours.push({id:"g",date:"",lieu:"Rome",titre:"Rome",recit:"Récit",tempsForts:[],distance:"",duree:"",photos:[photo("p1"),photo("p2"),photo("p3")],galeries:[Array.from({length:6},(_,i)=>photo(`g${i}`))],compacte:false});
  const html=construireHtml({voyage:{titre:"Voyage"},statistiques:{journeesIllustrees:5,photos:16},journees:jours});
  for(const n of [1,2,3,4,6]) assert.match(html,new RegExp(`count-${n}`));
  for(const id of ["p1","p2","p3",...Array.from({length:6},(_,i)=>`g${i}`)]) assert.equal((html.match(new RegExp(`base64,${id}`,"g"))||[]).length,1);
});

test("les étapes compactes sont regroupées et le programme reste explicitement prévu",()=>{
  const jours=Array.from({length:6},(_,i)=>({id:String(i),date:`2026-08-0${i+1}`,lieu:`Étape ${i}`,titre:`Étape ${i}`,recit:"",tempsForts:[],distance:"20 km",duree:"30 min",photos:[],galeries:[],compacte:true,programmePrevu:i===0?["Musée"]:[]}));
  const html=construireHtml({voyage:{titre:"Voyage"},statistiques:{journeesIllustrees:0,photos:0},journees:jours});
  assert.equal((html.match(/class="sheet compact"/g)||[]).length,2);
  assert.match(html,/Programme prévu/);assert.doesNotMatch(html,/Moments forts/);
});

test("un récit long crée des pages de continuation sans perdre le texte",()=>{
  const recit=Array.from({length:900},(_,i)=>`mot${i}`).join(" ");
  const html=construireHtml({voyage:{titre:"Long voyage"},statistiques:{journeesIllustrees:0,photos:0},journees:[{id:"1",date:"",lieu:"Paris",titre:"Paris",recit,tempsForts:[],distance:"",duree:"",photos:[],galeries:[],compacte:false}]});
  assert.ok((html.match(/class="sheet/g)||[]).length>3);
  assert.match(html,/mot0/); assert.match(html,/mot899/);
  assert.doesNotMatch(html,/standfirst|introduction/);
});
