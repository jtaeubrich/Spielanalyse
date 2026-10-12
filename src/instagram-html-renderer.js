import { INSTAGRAM_SIZE, escapeTemplateText } from "./instagram-template.js";
import { validateInstagramTemplate } from "./instagram-template-manager.js";

const IMAGE_DATA=/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i;
export function fillInstagramHtml(html,kind,fields={}){
 const validation=validateInstagramTemplate(html,kind);
 if(!validation.valid)throw Error(validation.issues.join(" | "));
 const doc=new DOMParser().parseFromString(html,"text/html");
 for(const [name,value] of Object.entries(fields)){
   const node=doc.querySelector('[data-field="'+name+'"]');
   if(!node)continue;
   if(name==="homeLogo"||name==="awayLogo"){
     const src=String(value||"");
     node.replaceChildren();
     if(src&&IMAGE_DATA.test(src)){
       const img=doc.createElement("img");img.src=src;img.alt=name==="homeLogo"?"Heimlogo":"Gastlogo";
       img.style.cssText="width:100%;height:100%;object-fit:contain";node.append(img);
     }else node.textContent="LOGO";
   }else if(name!=="videoArea") node.textContent=String(value??"");
 }
 return "<!doctype html>"+doc.documentElement.outerHTML;
}

// Paint from a live layout tree. SVG foreignObject is intentionally avoided:
// Chromium marks its canvas as tainted, even for self-contained documents.
export async function rasterizeInstagramHtml(html,{width=INSTAGRAM_SIZE.width,height=INSTAGRAM_SIZE.height,withGeometry=false}={}){
 const doc=new DOMParser().parseFromString(html,"text/html");
 for(const img of doc.images)if(!IMAGE_DATA.test(img.getAttribute("src")||""))throw Error("Nur eingebettete Base64-Bilder sind im HTML-Export erlaubt.");
 const frame=document.createElement("iframe");
 frame.setAttribute("sandbox","allow-same-origin");
 frame.setAttribute("aria-hidden","true");
 frame.style.cssText="position:fixed;left:-20000px;top:0;width:"+width+"px;height:"+height+"px;border:0;pointer-events:none;opacity:0";
 document.body.append(frame);
 try {
  frame.srcdoc=html;
  await new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=()=>reject(Error("HTML-Vorschau konnte nicht geladen werden."))});
  const win=frame.contentWindow,root=frame.contentDocument.body;
  if(win.document.fonts?.ready)await win.document.fonts.ready;
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d"),origin=root.getBoundingClientRect();
  ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);
  const imageCache=new Map();
  const point=rect=>({x:rect.left-origin.left,y:rect.top-origin.top,w:rect.width,h:rect.height});
  const paint=async el=>{
   const cs=win.getComputedStyle(el);
   if(cs.display==="none"||cs.visibility==="hidden"||Number(cs.opacity)===0)return;
   const p=point(el.getBoundingClientRect());
   if(p.w===0||p.h===0)return;
   ctx.save();
   const alpha=Number(cs.opacity);if(Number.isFinite(alpha))ctx.globalAlpha*=alpha;
   const radius=parseFloat(cs.borderTopLeftRadius)||0;
   const box=()=>{ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,Math.min(radius,p.w/2,p.h/2));};
   if(cs.backgroundColor!=="rgba(0, 0, 0, 0)"&&cs.backgroundColor!=="transparent"){box();ctx.fillStyle=cs.backgroundColor;ctx.fill();}
   const imageUrl=cs.backgroundImage.match(/url\(["']?(data:image\/(?:png|jpeg|webp|gif);base64,[^"')]+)["']?\)/i)?.[1];
   if(imageUrl){let img=imageCache.get(imageUrl);if(!img){img=await loadImage(imageUrl);imageCache.set(imageUrl,img);}
     const fit=cs.backgroundSize==="cover"?Math.max(p.w/img.width,p.h/img.height):Math.min(p.w/img.width,p.h/img.height);
     const w=img.width*fit,h=img.height*fit;ctx.save();box();ctx.clip();ctx.drawImage(img,p.x+(p.w-w)/2,p.y+(p.h-h)/2,w,h);ctx.restore();
   }
   if(cs.borderTopWidth!=="0px"&&cs.borderTopStyle!=="none"){box();ctx.strokeStyle=cs.borderTopColor;ctx.lineWidth=parseFloat(cs.borderTopWidth)||1;ctx.stroke();}
   if(el.tagName==="IMG"){let img=imageCache.get(el.src);if(!img){img=await loadImage(el.src);imageCache.set(el.src,img);}
     const fit=Math.min(p.w/img.width,p.h/img.height);ctx.drawImage(img,p.x+(p.w-img.width*fit)/2,p.y+(p.h-img.height*fit)/2,img.width*fit,img.height*fit);
   }
   if(cs.overflow==="hidden"){box();ctx.clip();}
   for(const child of el.childNodes){
    if(child.nodeType===1)await paint(child);
    else if(child.nodeType===3&&child.textContent.trim())drawText(child,cs);
   }
   ctx.restore();
  };
  function drawText(node,cs){
   const text=node.textContent;
   ctx.fillStyle=cs.color;ctx.font=cs.fontWeight+" "+cs.fontSize+" "+cs.fontFamily;
   ctx.textAlign="left";ctx.textBaseline="alphabetic";
   // Range measures text runs after CSS layout, preserving line wraps.
   const chars=[...text];let i=0;
   while(i<chars.length){
     if(/\s/.test(chars[i])){i++;continue;}
     const start=i;let rect=null;
     while(i<chars.length&&!/\s/.test(chars[i]))i++;
     const range=win.document.createRange();range.setStart(node,start);range.setEnd(node,i);
     rect=range.getBoundingClientRect();if(!rect.width)continue;
     const fontSize=parseFloat(cs.fontSize)||16;
     const x=rect.left-origin.left,y=rect.bottom-origin.top-(parseFloat(cs.lineHeight)||fontSize*1.2-fontSize)*.15;
     ctx.fillText(chars.slice(start,i).join(""),x,y);
   }
  }
  const video=frame.contentDocument.querySelector('[data-field="videoArea"]');
  const videoArea=video?point(video.getBoundingClientRect()):null;
  await paint(root);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error("PNG-Erzeugung fehlgeschlagen.")),"image/png"));
  return withGeometry?{blob,videoArea}:blob;
 }finally{frame.remove();}
}
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error("Eingebettetes Bild konnte nicht geladen werden."));image.src=src;});}
