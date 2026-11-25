// ==UserScript==
// @name         SAS – dépôt automatique du Bundle sur le FHIR Editor Simulator
// @namespace    https://github.com/karim-achour-ans/lrm_mock_interface
// @version      1.1
// @description  Remplit et soumet en arrière-plan le formulaire « Configure fhir static response » avec le Bundle préparé dans l'éditeur de créneaux SAS.
// @match        https://sas-fhir-editor-simulator-*.ans.kleegroup.ovh/admin*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function(){
async function sasBundleAgent(manual){
  var KEY="sasBundlePayload", REG="/admin?routeName=admin_register_fhir_file_data";
  var framed=false; try{ framed=window.top!==window; }catch(_){ framed=true; }
  function notify(stage,ok,msg){ if(framed&&window.parent) try{ window.parent.postMessage({type:"sas-bundle",stage:stage,ok:ok,msg:msg},"*"); }catch(_){} }
  function banner(msg,kind){
    var b=document.getElementById("sasbundle-banner");
    if(!b){ b=document.createElement("div"); b.id="sasbundle-banner"; b.setAttribute("role","status");
      b.style.cssText="position:fixed;z-index:2147483647;top:14px;left:50%;transform:translateX(-50%);max-width:min(720px,92vw);padding:12px 18px;border-radius:8px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.22)";
      document.body.appendChild(b); }
    b.style.background=kind==="err"?"#fce8e6":kind==="ok"?"#e4f3ea":"#e2eff3";
    b.style.color=kind==="err"?"#b3261e":kind==="ok"?"#2f7a4d":"#1f6f8b";
    b.textContent=msg;
  }
  async function decode(s){
    s=s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4) s+="=";
    var bin=Uint8Array.from(atob(s),function(c){return c.charCodeAt(0);});
    var txt=await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
    return JSON.parse(txt);
  }
  var job=null, m=location.hash.match(/sas-bundle=v1\.([A-Za-z0-9_-]+)/);
  if(m){
    history.replaceState(null,"",location.pathname+location.search);
    notify("ready");
    try{ job=await decode(m[1]); }catch(e){ banner("Bundle illisible dans l'adresse : "+e.message,"err"); notify("done",false,"Bundle illisible : "+e.message); return; }
    sessionStorage.setItem(KEY,JSON.stringify(job));
  } else {
    var saved=sessionStorage.getItem(KEY); if(saved) job=JSON.parse(saved);
  }
  if(!job){ if(manual) banner("Aucun Bundle en attente : lancez le dépôt depuis l'éditeur de créneaux SAS.","err"); return; }
  var form=document.querySelector('form[name="fhir_data_form"]');
  if(!form){
    if(location.search.indexOf("admin_register_fhir_file_data")<0){ location.href=location.origin+REG; return; }
    sessionStorage.removeItem(KEY); banner("Formulaire « Configure fhir static response » introuvable sur cette page.","err"); notify("done",false,"Formulaire du simulateur introuvable."); return;
  }
  sessionStorage.removeItem(KEY);
  function set(name,v){ var e=form.querySelector('[name="'+name+'"]'); if(e&&v!=null){ e.value=v; e.dispatchEvent(new Event("input",{bubbles:true})); e.dispatchEvent(new Event("change",{bubbles:true})); } return e; }
  set("fhir_data_form[jsonData]",job.bundle);
  set("fhir_data_form[parameters][editorName]",job.editor);
  set("fhir_data_form[parameters][resource]",job.resource||"Slot");
  banner("Dépôt du Bundle pour l'éditeur « "+job.editor+" »…");
  var fd=new FormData(form), btn=form.querySelector('[type="submit"]');
  if(btn&&btn.name&&!fd.has(btn.name)) fd.append(btn.name,"");
  var r,html;
  try{ r=await fetch(form.getAttribute("action")||location.href,{method:"POST",body:fd,credentials:"same-origin"}); html=await r.text(); }
  catch(e){ banner("Échec de l'envoi au simulateur : "+e.message+". Le formulaire est rempli : cliquez sur Submit.","err"); notify("done",false,"Échec de l'envoi : "+e.message); return; }
  var doc=new DOMParser().parseFromString(html,"text/html");
  var errs=[].slice.call(doc.querySelectorAll(".invalid-feedback,.form-error-message,.alert-danger,.alert-error,.form-errors li,form ul li")).map(function(e){return e.textContent.trim();}).filter(Boolean);
  if(!r.ok||errs.length){ var why=errs.length?errs.join(" · ").replace(/[.\s]+$/,""):"HTTP "+r.status; banner("Le simulateur a refusé le Bundle : "+why+". Le formulaire est rempli : corrigez puis cliquez sur Submit.","err"); notify("done",false,"Le simulateur a refusé le Bundle : "+why); return; }
  var ok=[].slice.call(doc.querySelectorAll(".alert-success,.flash-success")).map(function(e){return e.textContent.trim();}).filter(Boolean).join(" · ");
  notify("done",true,ok);
  if(job.next&&!framed){ banner("Bundle déposé pour « "+job.editor+" »"+(ok?" ("+ok+")":"")+". Ouverture de la recherche SAS…","ok"); setTimeout(function(){ location.href=job.next; },900); }
  else banner("Bundle déposé pour l'éditeur « "+job.editor+" »"+(ok?" — "+ok:"")+".","ok");
}
sasBundleAgent(false);
})();
