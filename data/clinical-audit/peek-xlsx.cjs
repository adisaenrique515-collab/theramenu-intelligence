const XLSX=require('xlsx');
const files=[
  {path:'C:/Users/erick/Downloads/2021-2023 FNDDS At A Glance - Ingredient Nutrient Values.xlsx',sheet:'Ingredient Nutrient Values'},
  {path:'C:/Users/erick/Downloads/2021-2023 FNDDS At A Glance - Portions and Weights.xlsx',sheet:'Portions and Weights'},
  {path:'C:/Users/erick/Downloads/supertrackerfooddatabase.xlsx',sheet:'Food_name'},
  {path:'C:/Users/erick/Downloads/supertrackerfooddatabase.xlsx',sheet:'Nutrient'},
  {path:'C:/Users/erick/Downloads/supertrackerfooddatabase.xlsx',sheet:'Portion_weight'}
];
for(const f of files){
  const wb=XLSX.readFile(f.path,{raw:true});
  const ws=wb.Sheets[f.sheet];
  if(!ws){console.log('MISSING',f.path,f.sheet);continue;}
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
  console.log('===',f.path,'::',f.sheet,'rows',rows.length,'===');
  for(let i=0;i<Math.min(12,rows.length);i++){
    const row=rows[i].slice(0,16).map(v=>String(v).trim());
    console.log(i+1,JSON.stringify(row));
  }
}
