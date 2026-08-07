import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

async function registre(){const source=await readFile(new URL("../../app/carnet-pdf/highlight-registry.js",import.meta.url),"utf8"),window={};vm.runInNewContext(source,{window});return window.CarnetHighlightRegistry;}

test("la catégorisation générique couvre les familles métier sans nom de lieu codé",async()=>{
  const r=await registre();
  const cas=[
    ["château","heritage"],["musée d’art","museum"],["cathédrale","heritage"],
    ["randonnée","mountain"],["plage","water"],["baignade","water"],["balade en bateau","water"],
    ["restaurant","gastronomy"],["dégustation","tasting"],["parc naturel","nature"],
    ["panorama","panorama"],["musée automobile","automotive"],["activité familiale","family"],
    ["expérience inconnue","activity"],["souvenir sans catégorie","family"],["élément inédit","other"]
  ];
  for(const [label,attendu] of cas)assert.equal(r.categoriser({label}),attendu,label);
  assert.equal(r.CATEGORIES.length,13);assert.ok(!Object.values(r.ICONES).join("").includes(">+<"));
});

test("une catégorie métier structurée prime sur le texte visible",async()=>{
  const r=await registre();
  assert.equal(r.categoriser({category:"nature",label:"Musée automobile"}),"nature");
  assert.equal(r.categoriser({type:"gastronomie",label:"Libellé neutre"}),"gastronomy");
  assert.equal(r.categoriser({label:"Tour historique",description:"Vue au sommet en famille"}),"architecture");
  assert.equal(r.categoriser({label:"Torre civique",description:"Vue au sommet"}),"architecture");
  assert.equal(r.categoriser({label:"Arco ancien",description:"Une famille locale"}),"heritage");
});
