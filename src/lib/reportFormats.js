import { csvText } from './exports';

export const REPORT_NOTE = 'Informational system-generated report; not institutional certification.';
const fontUrl = new URL('../assets/fonts/Roboto-Regular.ttf', import.meta.url).href;
const logoUrl = new URL('../assets/insync-report-logo.svg', import.meta.url).href;
const binaryString = bytes => { let value=''; for(let i=0;i<bytes.length;i+=8192) value+=String.fromCharCode(...bytes.subarray(i,i+8192)); return value; };
let fontPromise, logoPromise;
async function font() {
  fontPromise ||= fetch(fontUrl).then(async response => { if(!response.ok) throw new Error('Report font unavailable. Retry.'); return btoa(binaryString(new Uint8Array(await response.arrayBuffer()))); }).catch(error=>{fontPromise=null;throw error;});
  return fontPromise;
}
async function logo() {
  logoPromise ||= new Promise((resolve,reject)=>{
    const image=new Image(); image.onload=()=>{
      const canvas=document.createElement('canvas'); canvas.width=440;canvas.height=112;
      canvas.getContext('2d').drawImage(image,0,0,440,112);
      canvas.toBlob(blob=>blob ? blob.arrayBuffer().then(b=>resolve(new Uint8Array(b)),reject) : reject(new Error('Report logo unavailable.')),'image/png');
    }; image.onerror=()=>reject(new Error('Report logo unavailable. Retry.')); image.src=logoUrl;
  }).catch(error=>{logoPromise=null;throw error;});
  return logoPromise;
}
const cell = value => value == null ? 'Unknown' : typeof value==='number' && Number.isFinite(value) ? value : String(value);
export async function renderReport(model, format, assets = {}) {
  if (!['pdf','xlsx','csv'].includes(format)) throw new Error('Unsupported report format.');
  const filename=`insync-${model.key}-${model.generatedDate}.${format}`;
  const tables=model.tables.map(t=>({...t,rows:t.rows.map(row=>row.map(cell))}));
  if(format==='csv') {
    const rows=[['INSync',model.title],...model.metadata,[REPORT_NOTE],...model.warnings.map(w=>['Note',w]),[]];
    for(const t of tables) rows.push([t.title],t.headers,...t.rows,...(t.totals||[]).map(([k,v])=>[k,cell(v)]),[]);
    return {blob:new Blob([csvText(rows.shift(),rows)],{type:'text/csv;charset=utf-8'}),filename,count:model.count};
  }
  const logoBytes=assets.logoBytes || await logo();
  if(format==='xlsx') {
    const [{ default:writeExcelFile }, {unzipSync,zipSync,strFromU8,strToU8}]=await Promise.all([import('write-excel-file/universal'),import('fflate')]);
    const header = value => ({ type:String,value:String(value),fontWeight:'bold',color:'#FFFFFF',backgroundColor:'#0B1F33',wrap:true });
    const data=[[{...header(`INSync | ${model.title}`),height:42}],...model.metadata.map(row=>row.map(v=>({type:String,value:String(v),wrap:true}))),
      [{type:String,value:REPORT_NOTE,wrap:true}],...model.warnings.map(w=>[{type:String,value:w,wrap:true}]),[]];
    for(const t of tables) data.push([header(t.title)],t.headers.map(header),...t.rows.map(row=>row.map(v=>({type:typeof v==='number'?Number:String,value:v,wrap:true}))),
      ...(t.totals||[]).map(([k,v])=>[{type:String,value:k,fontWeight:'bold'},{type:typeof cell(v)==='number'?Number:String,value:cell(v)}]),[]);
    const columns=Array.from({length:Math.max(2,...tables.map(t=>t.headers.length))},()=>({width:24}));
    const blob=await writeExcelFile(data,{columns,images:[{content:logoBytes,contentType:'image/png',width:220,height:56,dpi:96,anchor:{row:0,column:columns.length-2}}],stickyRowsCount:model.metadata.length+1}).toBlob();
    // Print metadata is injected into the valid writer-produced OOXML package.
    const files=unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const sheet=strFromU8(files['xl/worksheets/sheet1.xml']);
    const print='<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;LINSync informational report&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter>';
    files['xl/worksheets/sheet1.xml']=strToU8(sheet.replace(/(<drawing\b|<\/worksheet>)/,`${print}$1`));
    return {blob:new Blob([zipSync(files)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),filename,count:model.count};
  }
  const count=tables.reduce((n,t)=>n+t.rows.length,0);
  if(count>5000) throw new Error('This PDF exceeds 5,000 rows. Export the complete dataset as Excel or CSV.');
  const [{jsPDF},{autoTable},fontData]=await Promise.all([import('jspdf'),import('jspdf-autotable'),assets.fontBase64 || font()]);
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
  doc.addFileToVFS('Roboto-Regular.ttf',fontData); doc.addFont('Roboto-Regular.ttf','Report','normal'); doc.setFont('Report','normal');
  const text=[model.title,REPORT_NOTE,...model.metadata.flat(),...model.warnings,...tables.flatMap(t=>[t.title,...t.headers,...t.rows.flat(),...(t.totals||[]).flat()])].join('');
  if([...text].some(c=>c.codePointAt(0)>65535 || (c.charCodeAt(0)>32 && !doc.getFont().metadata.characterToGlyph(c.charCodeAt(0)))))
    throw new Error('Some characters are unavailable in the PDF font. Export Excel or CSV to preserve the complete text.');
  const metadata=model.metadata.map(([k,v])=>`${k}: ${v}`);
  doc.setFontSize(8);
  const headerLines=doc.splitTextToSize([...metadata,...model.warnings.map(w=>`Note: ${w}`)].join(' | '),270), headerHeight=23+headerLines.length*4;
  const drawnHeaders=new Set();
  const drawHeader=()=>{
    const page=doc.getCurrentPageInfo().pageNumber;
    if(drawnHeaders.has(page))return;
    drawnHeaders.add(page);
    doc.addImage(logoBytes,'PNG',12,7,44,11); doc.setTextColor('#0B1F33');doc.setFontSize(12);doc.text(model.title,62,14);
    doc.setFontSize(8);doc.text(headerLines,12,23);doc.setDrawColor('#0E837D');doc.line(12,headerHeight,285,headerHeight);
  };
  let y=headerHeight+5;
  for(const t of tables) {
    if(y>165){doc.addPage();y=headerHeight+5;}
    doc.setFont('Report','normal');doc.setTextColor('#0B1F33');doc.setFontSize(10);doc.text(t.title,12,y); y+=3;
    autoTable(doc,{startY:y,head:[t.headers],body:t.rows.length?t.rows:[t.headers.map((_,i)=>i===0?'No matching records':'')],
      styles:{font:'Report',fontStyle:'normal',fontSize:7,overflow:'linebreak',cellPadding:1.5},
      headStyles:{fillColor:'#0B1F33',fontStyle:'normal'},margin:{left:12,right:12,top:headerHeight+5,bottom:18},
      rowPageBreak:'avoid',didDrawPage:drawHeader});
    y=doc.lastAutoTable.finalY+5;
    for(const [k,v] of t.totals||[]) {
      if(y>184){doc.addPage();y=headerHeight+5;drawHeader();}
      doc.setFontSize(8);doc.text(`${k}: ${cell(v)}`,12,y);y+=4;
    }
    y+=5;
  }
  for(let p=1;p<=doc.getNumberOfPages();p++) {
    doc.setPage(p);doc.setFont('Report','normal');doc.setFontSize(7);doc.setTextColor('#455A64');
    doc.text(REPORT_NOTE,12,201);doc.text(`Page ${p} of ${doc.getNumberOfPages()}`,285,201,{align:'right'});
  }
  return {blob:doc.output('blob'),filename,count:model.count};
}
