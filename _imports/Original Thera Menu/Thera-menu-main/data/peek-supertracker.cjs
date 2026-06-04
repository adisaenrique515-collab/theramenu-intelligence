const XLSX=require('xlsx');
const wb=XLSX.readFile('C:/Users/erick/Downloads/supertrackerfooddatabase.xlsx',{raw:true});
for(const s of ['Nutrients','Portion_data','Portions','Food_Categories']){
 const ws=wb.Sheets[s];
 const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
 console.log('===',s,'rows',rows.length,'===');
 for(let i=0;i<Math.min(10,rows.length);i++) console.log(i+1,JSON.stringify(rows[i].slice(0,16)));
}
