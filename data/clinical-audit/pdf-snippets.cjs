const fs=require('fs');
const { PDFParse }=require('pdf-parse');

const pdfs=[
  'C:/Users/erick/Downloads/2018CLINICALDIETMANUAL.pdf',
  'C:/Users/erick/Downloads/tdm.pdf',
  'C:/Users/erick/Downloads/Download_Field_Descriptions_Oct2020.pdf'
];

const queries=[
  'sodium', 'potassium', 'phosphorus', 'renal', 'diabetic', 'cardiac', 'dysphagia', 'texture',
  'food safety', 'hot holding', 'cold holding', 'allergen', 'portion', 'serving', 'fluid', 'IDDSI'
];

function snippets(text, q){
  const t=text.replace(/\s+/g,' ');
  const re=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig');
  const out=[];
  let m;
  while((m=re.exec(t)) && out.length<4){
    const s=Math.max(0,m.index-90);
    const e=Math.min(t.length,m.index+q.length+140);
    out.push(t.slice(s,e));
  }
  return out;
}

(async()=>{
  for(const p of pdfs){
    const parser=new PDFParse({data:fs.readFileSync(p)});
    const info=await parser.getInfo({parsePageInfo:false});
    const text=(await parser.getText()).text || '';
    await parser.destroy();
    console.log('===',p,'pages',info.total,'===');
    for(const q of queries){
      const s=snippets(text,q);
      if(s.length){
        console.log('['+q+']');
        for(const sn of s){ console.log(' - '+sn); }
      }
    }
  }
})();
