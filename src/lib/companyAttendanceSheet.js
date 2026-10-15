import { calendarDate } from './lists';
const fontUrl=new URL('../assets/fonts/Roboto-Regular.ttf',import.meta.url).href;
export function companySheetModel(context,companyId,start,end) {
  if(calendarDate(start)===null||calendarDate(end)===null||start>end)throw new Error('Select a valid covered period.');
  const company=context.companies.find(c=>c.id===companyId);if(!company)throw new Error('Choose the company for this sheet.');
  const count=(calendarDate(end)-calendarDate(start))/86400000+1;
  if(count>62)throw new Error('Choose up to 62 days per printable sheet set.');
  const rows=Array.from({length:count},(_,i)=>[new Date(calendarDate(start)+i*86400000).toISOString().slice(0,10),'','','','','','']);
  return {company:company.name,intern:context.intern_name,identifier:context.identifier,start,end,rows,
    headers:['Date','Time In','Time Out / end date','Intern signature','Supervisor signature','Supervisor printed name','Remarks'],
    instructions:'Print in advance and keep copies at the company. During an outage, record actual attendance on this sheet or a company logbook with these fields and signatures. Use Asia/Manila dates/times. Record the Time Out date for overnight sessions. The current system supports one session per Intern per start date, up to 16 hours. Once online, the Company Supervisor signs and uploads the logbook. The assigned OJT Coordinator reads it, encodes actual times and explicitly uses Verify & Record Attendance.'};
}
export async function companySheetPdf(model,assets={}) {
  const [{jsPDF},{autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
  const fontData=assets.fontBase64||await fetch(fontUrl).then(async r=>{if(!r.ok)throw new Error('Print font unavailable. Retry.');const bytes=new Uint8Array(await r.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);});
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
  doc.addFileToVFS('Roboto-Regular.ttf',fontData);doc.addFont('Roboto-Regular.ttf','Sheet','normal');doc.setFont('Sheet','normal');
  const allText=[model.company,model.intern,model.identifier,model.instructions,...model.headers].join('');
  if([...allText].some(c=>c.codePointAt(0)>65535||(c.charCodeAt(0)>32&&!doc.getFont().metadata.characterToGlyph(c.charCodeAt(0)))))throw new Error('The sheet font cannot print one of these characters. Ask your Coordinator to review the printed name.');
  doc.setFontSize(9);
  const headings=doc.splitTextToSize(`Company: ${model.company} | Intern: ${model.intern} | Identifier: ${model.identifier} | Covered period: ${model.start} through ${model.end}`,273);
  doc.setFontSize(8);
  const instructions=doc.splitTextToSize(model.instructions,273),top=23+headings.length*4+instructions.length*3.5+7;
  autoTable(doc,{startY:top,margin:{left:12,right:12,top,bottom:14},head:[model.headers],body:model.rows,
    styles:{font:'Sheet',fontSize:8,textColor:'#0B1F33',lineColor:'#B9CDCF',lineWidth:.2,cellPadding:2,minCellHeight:12,overflow:'linebreak'},
    headStyles:{fillColor:'#0B1F33',textColor:'#FFFFFF',fontStyle:'normal'},theme:'grid',rowPageBreak:'avoid',
    columnStyles:{0:{cellWidth:25},1:{cellWidth:22},2:{cellWidth:30},3:{cellWidth:39},4:{cellWidth:43},5:{cellWidth:52},6:{cellWidth:62}},
    didDrawPage:()=>{doc.setTextColor('#0B1F33');doc.setFontSize(17);doc.text('INSync',12,12);doc.setFontSize(13);doc.text('Company Attendance Sheet',47,12);doc.setFontSize(9);doc.text(headings,12,23);doc.setFontSize(8);doc.text(instructions,12,27+headings.length*4);}});
  const pages=doc.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFontSize(8);doc.text(`Blank paper fallback — attendance requires Coordinator encoding and explicit verification. | ${p} / ${pages}`,12,202);}
  return {blob:doc.output('blob'),filename:`insync-company-attendance-${model.start}-${model.end}.pdf`,pages};
}
