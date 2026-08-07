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

test("les journées fournies sont rendues sans page de roadbook et les trajets utilisent un SVG",()=>{
  const jours=Array.from({length:2},(_,i)=>({id:String(i),date:"2026-08-01",lieu:"Route",titre:"Lyon → Turin",recit:"",tempsForts:[],distance:"100 km",duree:"2 h",photos:[]}));
  const html=construireHtml({voyage:{titre:"Voyage"},statistiques:{journeesIllustrees:0,photos:0},journees:jours});
  assert.equal((html.match(/class="sheet compact-page"/g)||[]).length,0);assert.equal((html.match(/class="sheet story-page"/g)||[]).length,2);assert.match(html,/route-arrow/);assert.doesNotMatch(html,/Lyon → Turin|Carnet de route|étape par étape/);
});

test("les layouts suivent les orientations, conservent les ratios et ne croppent pas",()=>{
  const p=(i,r,l="")=>({dataUrl:`data:image/jpeg;base64,${i}`,ratio:r,orientation:r>1.12?"landscape":r<.88?"portrait":"square",legende:l});
  const html=construireHtml({voyage:{titre:"Voyage"},statistiques:{journeesIllustrees:1,photos:10},journees:[{id:"v",titre:"Vérone",recit:"Récit",tempsForts:[],photos:[p(1,1.6),p(2,1.5),p(3,1.7),p(4,1.4,"Deux lignes de légende")],galeries:[]},{id:"m",titre:"Modène",recit:"Récit",tempsForts:[],photos:[p(5,1.5),p(6,.7),p(7,.7)],galeries:[[p(8,1.5),p(9,.7),p(10,1),p(11,1.4),p(12,.65),p(13,1.6),p(14,.7)]]}]});
  assert.match(html,/photos-4-landscape/);assert.match(html,/photos-3-mixed/);assert.match(html,/gallery-7-mixed/);assert.match(html,/object-fit:contain/);assert.doesNotMatch(html,/object-fit:cover[^}]*main-photos/);
});

test("le scénario Vérone prête + Modène prête produit exactement cinq pages",()=>{const p=(i)=>({dataUrl:`data:image/jpeg;base64,${i}`,ratio:1.33,orientation:"landscape",legende:""}),verone=Array.from({length:4},(_,i)=>p(i)),modene=Array.from({length:10},(_,i)=>p(i+4));const html=construireHtml({voyage:{titre:"Voyage"},statistiques:{journeesIllustrees:2,photos:14},journees:[{id:"verone",titre:"Vérone",recit:"Récit",tempsForts:[],photos:verone,galeries:[]},{id:"modene",titre:"Modène",recit:"Récit",tempsForts:["Ferrari"],photos:modene.slice(0,3),galeries:[modene.slice(3)]}]});assert.equal((html.match(/class="sheet/g)||[]).length,5);assert.match(html,/photos-4-landscape/);assert.match(html,/text-align:center/);});

test("le rail garde une baseline fixe et distribue de un à cinq moments",()=>{for(let n=1;n<=5;n++){const html=construireHtml({voyage:{titre:"Voyage"},statistiques:{},journees:[{id:"j",titre:"Jour",recit:"Récit",photos:[],galeries:[],tempsForts:Array.from({length:n},(_,i)=>({libelle:`Moment ${i}`,category:"other"}))}]});assert.match(html,new RegExp(`highlights-count-${n}`));}const html=construireHtml({voyage:{titre:"Voyage"},statistiques:{},journees:[{id:"j",titre:"Jour",recit:"Récit",photos:[],galeries:[],tempsForts:[{libelle:"Musée",category:"museum"}]}]});assert.match(html,/grid-template-rows:auto minmax\(0,1fr\) 25mm/);assert.match(html,/grid-template-columns:repeat\(var\(--highlight-count\),minmax\(0,1fr\)\)/);});

test("les légendes partagent un gap global et les photos sans légende n'ont pas de figcaption",()=>{const html=construireHtml({voyage:{titre:"Voyage"},statistiques:{photos:2},journees:[{id:"j",titre:"Jour",recit:"Récit",tempsForts:[],galeries:[],photos:[{dataUrl:"a",legende:"Légende"},{dataUrl:"b",legende:""}]}]});assert.match(html,/--photo-caption-gap:1\.5mm/);assert.match(html,/margin-top:var\(--photo-caption-gap\)/);assert.equal((html.match(/<figcaption>/g)||[]).length,1);});

test("un récit long crée des pages de continuation sans perdre le texte",()=>{
  const recit=Array.from({length:900},(_,i)=>`mot${i}`).join(" ");
  const html=construireHtml({voyage:{titre:"Long voyage"},statistiques:{journeesIllustrees:0,photos:0},journees:[{id:"1",date:"",lieu:"Paris",titre:"Paris",introduction:"Intro",recit,tempsForts:[],distance:"",duree:"",photos:[],galeries:[]}]});
  assert.ok((html.match(/class="sheet/g)||[]).length>3);
  assert.match(html,/mot0/); assert.match(html,/mot899/);
});
