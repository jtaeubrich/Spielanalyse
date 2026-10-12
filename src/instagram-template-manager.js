export const TEMPLATE_FIELDS = {
  highlight: ["homeLogo","awayLogo","home","away","score","matchTime","playerName","eventType","comment","videoArea"],
  matchday: ["homeLogo","awayLogo","home","away"],
  endstand: ["homeLogo","awayLogo","home","away","score"]
};
export function validateInstagramTemplate(html, kind) {
  const required = TEMPLATE_FIELDS[kind];
  if (!required) return {valid:false,issues:["Unbekannter Vorlagentyp"]};
  const doc = new DOMParser().parseFromString(String(html), "text/html");
  const issues = [];
  if (!/<html/i.test(html) || !/<body/i.test(html)) issues.push("Vollständiges HTML-Dokument erforderlich");
  for (const key of required) if (!doc.querySelector('[data-field="'+key+'"]')) issues.push("Fehlender Platzhalter: "+key);
  if (doc.querySelector("script,iframe,object,embed,base,link")) issues.push("Skripte, externe Einbettungen und Links sind nicht erlaubt");
  if (Array.from(doc.querySelectorAll("*")).some(el => Array.from(el.attributes).some(a => a.name.startsWith("on")))) issues.push("Inline-Eventhandler sind nicht erlaubt");
  const styles = [...doc.querySelectorAll("style")].map(el => el.textContent || "").concat([...doc.querySelectorAll("[style]")].map(el => el.getAttribute("style") || ""));
  for (const css of styles) {
    if (/@import\b/i.test(css)) { issues.push("CSS-Importe sind nicht erlaubt"); break; }
    const urls = [...css.matchAll(/url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)];
    if (urls.some(match => !/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test((match[1] ?? match[2] ?? match[3] ?? "").trim()))) {
      issues.push("Externe CSS-Ressourcen sind nicht erlaubt"); break;
    }
  }
  return {valid:issues.length===0,issues};
}
export function templatePrompt(kind="highlight") {
  const fields = TEMPLATE_FIELDS[kind] || TEMPLATE_FIELDS.highlight;
  return [
    "Entwickle eine vollständige eigenständige HTML5-Datei als Instagram-Template für Handball.",
    "Canvas exakt 1080 x 1350 Pixel (4:5). Integriertes CSS, keine JavaScript-Dateien, keine externen Ressourcen.",
    "Modernes sportliches Design, starke Typografie, gut lesbare Metadaten. Verwende gegebenenfalls einen bereitgestellten Referenz-Screenshot.",
    "Erhalte folgende data-field-Attribute unverändert: "+fields.join(", ")+".",
    "Gestalte Heim- und Gastlogos als Platzhalter innerhalb der jeweiligen data-field-Elemente.",
    "Spielstand und Spielzeit ausdrücklich beschriften; lange Namen berücksichtigen.",
    kind==="highlight" ? "videoArea ist ein fest positionierter rechteckiger Bereich im Verhältnis 16:9. Kommentar unter dem Video." : "",
    "Beispieldaten: TSV Kronshagen gegen Beispielgegner, 18 : 16, Spielzeit 42:13, Spieler Jespe Täubrich, TOR, Kommentar: Starker Durchbruch.",
    "Liefere ausschließlich vollständigen HTML-Quelltext mit eingebettetem CSS."
  ].filter(Boolean).join("\n");
}
