(function(root){
 'use strict';
 function parse(text){
  text=String(text).replace(/^\uFEFF/,'');if(text.length>5*1024*1024)throw Error('CSV de hasta 5 MB');
  const rows=[];let row=[],field='',quoted=false,afterQuote=false;
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;afterQuote=true;}}else field+=c;continue;}
   if(c==='"'){if(field||afterQuote)throw Error('Comillas inesperadas en CSV');quoted=true;continue;}
   if(c===','||c==='\n'||c==='\r'){row.push(field);field='';afterQuote=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v!==''))rows.push(row);row=[];}continue;}
   if(afterQuote&&c!==' '&&c!=='\t')throw Error('Texto después del cierre de comillas');if(!afterQuote)field+=c;
  }
  if(quoted)throw Error('CSV con comillas sin cerrar');row.push(field);if(row.some(v=>v!==''))rows.push(row);
  if(!rows.length)throw Error('CSV vacío');const headers=rows.shift().map(v=>v.trim());if(new Set(headers).size!==headers.length)throw Error('Cabeceras duplicadas');
  if(!headers.includes('id')||!headers.includes('quantity'))throw Error('Se requieren id y quantity');
  if(rows.length>1000)throw Error('Máximo 1000 filas por importación');
  return rows.map((values,index)=>{if(values.length!==headers.length)throw Error('Número de columnas incorrecto en fila '+(index+2));return Object.fromEntries([['_row',index+2],...headers.map((h,i)=>[h,values[i]])]);});
 }
 function cell(value){let s=String(value??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function stringify(rows,headers){return '\uFEFF'+[headers,...rows.map(row=>headers.map(h=>row[h]??''))].map(row=>row.map(cell).join(',')).join('\r\n');}
 const api={parse,stringify};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ChiniCSV=api;
})(globalThis);
