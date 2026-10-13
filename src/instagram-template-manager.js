export const TEMPLATE_FIELDS = {
  highlight: ["homeLogo","awayLogo","home","away","score","matchTime","playerName","eventType","comment","videoArea","competition"],
  matchday: ["homeLogo","awayLogo","home","away","competition","playerName","eventType"],
  endstand: ["homeLogo","awayLogo","home","away","score","competition","eventType"]
};
export function validateInstagramTemplate(html, kind) {
  const required = TEMPLATE_FIELDS[kind];
  if (!required) return {valid:false,issues:["Unbekannter Vorlagentyp: "+kind]};
  const source=String(html||"");
  const doc=new DOMParser().parseFromString(source,"text/html");
  const issues=[];
  if (!/<html/i.test(source)||!/<body/i.test(source)) issues.push("Vollständiges HTML-Dokument erforderlich");
  const missing=required.filter(key=>!doc.querySelector('[data-field="'+key+'"]'));
  for(const el of doc.querySelectorAll("script,iframe,object,embed,base,link")) issues.push("Verbotenes HTML-Element: <"+el.tagName.toLowerCase()+">");
  for(const el of doc.querySelectorAll("*")) for(const attribute of el.attributes) {
    if(/^on/i.test(attribute.name)) issues.push("Verbotener Eventhandler: <"+el.tagName.toLowerCase()+"> "+attribute.name);
  }
  const styleBlocks=[...doc.querySelectorAll("style")].map(el=>el.textContent||"");
  const inlineStyles=[...doc.querySelectorAll("[style]")].map(el=>el.getAttribute("style")||"");
  const explain=(css,where)=>{
    if(/@import\b/i.test(css)) issues.push(where+": CSS @import ist nicht erlaubt");
    // Quoted CSS URLs must be parsed without truncating at punctuation within a base64 payload.
    const urlPattern=/url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi;
    for(const match of css.matchAll(urlPattern)){
      const value=(match[1]??match[2]??match[3]??"").trim();
      if(/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value))continue;
      const line=css.slice(0,match.index).split("\n").length;
      const shown=value.length>100?value.slice(0,100)+"…":value;
      issues.push(where+", CSS-Zeile "+line+": Unzulässige URL: "+shown);
    }
  };
  styleBlocks.forEach((css,i)=>explain(css,"<style> #"+(i+1)));
  inlineStyles.forEach((css,i)=>explain(css,'style-Attribut #'+(i+1)));
  return {valid:issues.length===0,issues,missing,fields:required.map(name=>({name,present:!missing.includes(name)}))};
}
export function templatePrompt(kind="highlight") {
  const fields = TEMPLATE_FIELDS[kind] || TEMPLATE_FIELDS.highlight;
  return [
    "Entwickle eine vollständige eigenständige HTML5-Datei als Instagram-Template für Handball.",
    "Canvas exakt 1080 x 1350 Pixel (4:5). Integriertes CSS, keine JavaScript-Dateien, keine externen Ressourcen.",
    "Modernes sportliches Design, starke Typografie, gut lesbare Metadaten. Verwende gegebenenfalls einen bereitgestellten Referenz-Screenshot.",
    "Verwende folgende data-field-Attribute unverändert: "+fields.join(", ")+". Die Vorlage darf weitere gestalterische Elemente enthalten.",
    "Zeige den Wettbewerb gut lesbar oberhalb der Mannschaften mit data-field=\"competition\". Der Wert wird automatisch aus den Spieldaten übernommen; keine Wettbewerbsbezeichnung fest eintragen.",
    "Gestalte Heim- und Gastlogos als Platzhalter innerhalb der jeweiligen data-field-Elemente.",
    "Spielstand und Spielzeit ausdrücklich beschriften; lange Namen berücksichtigen.",
    kind==="highlight" ? "videoArea ist ein fest positionierter rechteckiger Bereich im Verhältnis 16:9. Kommentar unter dem Video." : "",
    "Beispieldaten: TSV Kronshagen gegen Beispielgegner, 18 : 16, Spielzeit 42:13, Spieler Jespe Täubrich, TOR, Kommentar: Starker Durchbruch.",
    "Liefere ausschließlich vollständigen HTML-Quelltext mit eingebettetem CSS."
  ].filter(Boolean).join("\n");
}
