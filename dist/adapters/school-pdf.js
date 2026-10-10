import {validateCourse,parseWeeks} from '../core/model.js';
export function parsePDFPages(pages){
 const first=pages[0]||[],headers=['一','二','三','四','五','六','日'].map(day=>first.find(t=>t.s.replace(/\s/g,'')==='星期'+day));
 if(headers.some(x=>!x))throw Error('没有识别到星期列。请使用教务系统直接导出的文字 PDF，扫描图片暂不支持。');
 const step=(headers[6].x-headers[0].x)/6,left=headers[0].x+headers[0].w/2-step/2,columns=Array(7).fill(''),warnings=[];
 for(let page=0;page<pages.length;page++){
  const items=pages[page];for(const t of items){if(t.s.includes('其他课程'))warnings.push(t.s.replace('其他课程：','').replace(/&ldquo;|&rdquo;/g,'“'));}
  for(let day=0;day<7;day++)columns[day]+=items.filter(t=>t.s.trim()&&t.x>=left+day*step-2&&t.x<left+(day+1)*step-2&&(page>0||t.y>headers[0].y+3)&&!(/打印时间|其他课程|星期[一二三四五六日]|^: 理论/.test(t.s))).sort((a,b)=>a.y-b.y||a.x-b.x).map(t=>t.s).join('');
 }
 const courses=[];for(let day=1;day<=7;day++){
  const text=columns[day-1].replace(/\s/g,''),matches=[...text.matchAll(/\((\d+)-(\d+)节\)([^/]+)/g)];
  for(let i=0;i<matches.length;i++){const m=matches[i],block=text.slice(m.index,matches[i+1]?.index??text.length);const field=(name,next)=>{const match=block.match(new RegExp('/'+name+':(.*?)/'+next+':'));if(!match)throw Error(`周${day}第${i+1}条排课的${name}不完整。未覆盖已有课表，请检查 PDF。`);return match[1];};const teaching=field('教学班','教学班组成'),name=teaching.split('-')[0],location=field('场地','教师'),teacher=field('教师','教学班');courses.push(validateCourse({name,day,start:Number(m[1]),end:Number(m[2]),weeks:parseWeeks(m[3].replace(/第/g,'')),location,teacher,note:'校区：'+field('校区','场地')},courses.length));}
 }
 if(!courses.length)throw Error('PDF 中没有可识别的排课记录，已有课表保持不变。');
 const names=new Map(),colors=['blue','mint','purple','peach','rose','yellow'];for(const c of courses){if(!names.has(c.name))names.set(c.name,colors[names.size%colors.length]);c.color=names.get(c.name);}
 const term=first.find(t=>/\d{4}-\d{4}学年第\d学期/.test(t.s))?.s;
 return {version:1,courses,demo:false,warnings,term,adapter:'正方课表 PDF'};
}
export async function parseSchoolPDF(bytes,onProgress=()=>{}){
 const pdf=await import('../vendor/pdfjs/pdf.js');pdf.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.js',import.meta.url).href;
 const task=pdf.getDocument({data:bytes,cMapUrl:new URL('../vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('../vendor/pdfjs/standard_fonts/',import.meta.url).href});const doc=await task.promise;
 try{if(doc.numPages>30)throw Error('PDF 超过 30 页，请只选择课表文件');const pages=[];for(let n=1;n<=doc.numPages;n++){onProgress(`正在读取第 ${n}/${doc.numPages} 页…`);const page=await doc.getPage(n),vp=page.getViewport({scale:1}),text=await page.getTextContent();pages.push(text.items.filter(t=>t.str).map(t=>{const p=pdf.Util.transform(vp.transform,t.transform);return {s:t.str,x:p[4],y:p[5],w:t.width};}));}return parsePDFPages(pages);}finally{await doc.destroy();}
}
