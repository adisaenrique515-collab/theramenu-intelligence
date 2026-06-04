const XLSX=require('xlsx');
const wb=XLSX.readFile('C:/Users/erick/Downloads/supertrackerfooddatabase.xlsx',{raw:true});
console.log(wb.SheetNames);
