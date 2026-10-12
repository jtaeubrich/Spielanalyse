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

// Browser-native SVG foreignObject snapshot. No remote CSS, scripts or dependencies.
export async function rasterizeInstagramHtml(html,{width=INSTAGRAM_SIZE.width,height=INSTAGRAM_SIZE.height}={}){
 const doc=new DOMParser().parseFromString(html,"text/html");
 const styles=[...doc.querySelectorAll("style")].map(el=>el.textContent||"").join("\n");
 const body=doc.body.cloneNode(true);
 body.setAttribute("xmlns","http://www.w3.org/1999/xhtml");
 body.style.cssText="margin:0;width:"+width+"px;height:"+height+"px;overflow:hidden";
 for(const el of body.querySelectorAll("img")){
   if(!IMAGE_DATA.test(el.getAttribute("src")||""))throw Error("Nur eingebettete Base64-Bilder sind im HTML-Export erlaubt.");
 }
 const xml=new XMLSerializer().serializeToString(body);
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>'+escapeXmlStyle(styles)+'</style>'+xml+'</div></foreignObject></svg>';
 const image=new Image();
 const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}));
 try{
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error("HTML-Template konnte nicht gerendert werden."));image.src=url});
   const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
   canvas.getContext("2d").drawImage(image,0,0);
   return await new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob?resolve(blob):reject(Error("PNG-Erzeugung fehlgeschlagen.")),"image/png")}catch(e){reject(Error("Browser unterstützt HTML-Template-Rasterung nicht: "+e.message))}});
 }finally{URL.revokeObjectURL(url)}
}
function escapeXmlStyle(value){return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
