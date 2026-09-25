const state={items:[],groups:new Map()};

const $=s=>document.querySelector(s);
const norm=s=>(s??"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

function distance(a,b){
  if(a===b)return 0;
  if(!a)return b.length;
  if(!b)return a.length;
  const prev=Array(b.length+1).fill(0).map((_,i)=>i);
  for(let i=0;i<a.length;i++){
    let cur=[i+1], rowMin=cur[0];
    for(let j=0;j<b.length;j++){
      const v=a[i]===b[j]?prev[j]:Math.min(prev[j]+1,cur[j]+1,prev[j+1]+1);
      cur.push(v); rowMin=Math.min(rowMin,v);
    }
    if(rowMin>Math.max(3,Math.floor(b.length*.45))) return rowMin;
    for(let j=0;j<cur.length;j++)prev[j]=cur[j];
  }
  return prev[b.length];
}

// Fuzzy search is deliberately conservative:
// - exact/prefix/substring matches always win
// - otherwise accept only close matches, with a minimum query length of 4
function score(query,text){
  const q=norm(query), t=norm(text);
  if(!q)return 0;
  if(t===q)return 100;
  if(t.startsWith(q))return 90;
  if(t.includes(q))return 80;
  if(q.length<4)return -Infinity;
  const d=distance(q,t);
  const ratio=d/Math.max(q.length,t.length);
  if(ratio<=.18)return 65-ratio*20;
  if(ratio<=.28 && q.length>=6)return 45-ratio*15;
  return -Infinity;
}

function typeOf(file,name){
  const n=norm(name);
  if(file==="DLC.json")return "DLC";
  if(file==="UPDATES.json")return "Update";
  return "Base";
}

function detectSchema(data){
  if(!data || typeof data!=="object" || Array.isArray(data))
    return {ok:false,error:"O arquivo precisa conter um objeto JSON na raiz."};

  if(!data.DATA || typeof data.DATA!=="object" || Array.isArray(data.DATA))
    return {ok:false,error:'Campo "DATA" não encontrado ou não é um objeto.'};

  const entries=Object.entries(data.DATA);
  if(!entries.length)
    return {ok:false,error:'O campo "DATA" está vazio.'};

  const sample=entries[0][1];
  if(!sample || typeof sample!=="object" || Array.isArray(sample))
    return {ok:false,error:'Cada item dentro de "DATA" precisa ser um objeto.'};

  const required=["title_id","name"];
  const missing=required.filter(k=>!(k in sample));
  if(missing.length)
    return {ok:false,error:`Campo(s) obrigatório(s) ausente(s): ${missing.join(", ")}.`};

  if(typeof sample.title_id!=="string" || typeof sample.name!=="string")
    return {ok:false,error:'"title_id" e "name" precisam ser textos (strings).'};

  return {ok:true};
}

function exampleJSON(){
  return `{
  "DATA": {
    "https://exemplo.com/arquivo.pkg": {
      "title_id": "CUSA12345",
      "name": "Final Fantasy Example",
      "version": "01.00",
      "region": "USA",
      "size": 123456789,
      "cover_url": "https://exemplo.com/capa.jpg"
    }
  }
}`;
}

function addData(file,data){
  const check=detectSchema(data);
  if(!check.ok) throw new Error(check.error);
  let n=0;
  for(const [url,meta] of Object.entries(data.DATA)){
    if(!meta || typeof meta!=="object")continue;
    state.items.push({...meta,url,_type:typeOf(file,meta.name),_source:file});
    n++;
  }
  return n;
}

function rebuild(){
  state.groups=new Map();
  for(const x of state.items){
    const id=x.title_id;
    if(!state.groups.has(id))state.groups.set(id,{id,name:x.name||id,region:x.region||"",cover:x.cover_url||"",base:[],updates:[],dlcs:[]});
    const g=state.groups.get(id);
    if(x._type==="Base")g.base.push(x);
    else if(x._type==="Update")g.updates.push(x);
    else g.dlcs.push(x);
    if(!g.cover&&x.cover_url)g.cover=x.cover_url;
    if((x.name||"").length < (g.name||"").length)g.name=x.name;
  }
  render();
}

function fmtSize(n){
  if(!Number.isFinite(+n))return "";
  const u=["B","KB","MB","GB","TB"]; let i=0,v=+n;
  while(v>=1024&&i<u.length-1){v/=1024;i++}
  return `${v.toFixed(i?2:0)} ${u[i]}`;
}

function bestScore(g,q){
  if(!q)return 1;
  const fields=[g.name,g.id,g.region];
  const scores=fields.map(x=>score(q,x)).filter(x=>x>-Infinity);
  return scores.length?Math.max(...scores):-Infinity;
}

function row(x){
  const div=document.createElement("div");div.className="row";
  const left=document.createElement("span");
  left.textContent=`${x.name||"(sem nome)"}${x.version?` — v${x.version}`:""}`;
  const right=document.createElement("small");
  right.textContent=[x.region,fmtSize(x.size)].filter(Boolean).join(" • ");
  div.append(left,right);
  if(x.url){
    const link=document.createElement("a");
    link.className="itemLink";
    link.href=x.url;
    link.target="_blank";
    link.rel="noopener noreferrer";
    link.textContent="Abrir";
    div.append(link);
  }
  return div;
}

function render(){
  const root=$("#results"), q=$("#search").value.trim(), reg=$("#region").value;
  root.innerHTML="";
  const arr=[...state.groups.values()]
    .filter(g=>!reg||g.region===reg)
    .map(g=>({g,s:bestScore(g,q)}))
    .filter(x=>x.s>-Infinity)
    .sort((a,b)=>b.s-a.s||a.g.name.localeCompare(b.g.name));
  if(!arr.length){root.innerHTML="<p>Nenhum resultado encontrado.</p>";return}
  for(const {g} of arr){
    const node=$("#gameTemplate").content.cloneNode(true);
    const img=node.querySelector(".cover");
    img.src=g.cover||"";
    img.onerror=()=>{img.style.visibility="hidden"};
    node.querySelector(".title").textContent=g.name;
    node.querySelector(".meta").textContent=`${g.id}${g.region?" • "+g.region:""}`;
    const chips=node.querySelector(".chips");
    for(const [label,list] of [["Base",g.base],["Updates",g.updates],["DLCs",g.dlcs]]){
      if(list.length){const c=document.createElement("span");c.className="chip";c.textContent=`${label}: ${list.length}`;chips.append(c)}
    }
    const contents=node.querySelector(".contents");
    const head=node.querySelector(".gameHead");
    head.addEventListener("click",()=>{
      const article=head.closest(".game");
      article.classList.toggle("open");
    });

    const groups=[
      ["Jogo base",g.base],
      ["Updates",g.updates],
      ["DLCs",g.dlcs]
    ];
    for(const [label,list] of groups){
      if(!list.length) continue;
      const st=document.createElement("div");
      st.className="sectionTitle";
      st.textContent=`${label} (${list.length})`;
      contents.append(st);
      [...list]
        .sort((a,b)=>(a.version||"").localeCompare(b.version||"",undefined,{numeric:true}))
        .forEach(x=>contents.append(row(x)));
    }
    root.append(node);
  }
}

$("#search").addEventListener("input",render);
$("#region").addEventListener("change",render);

$("#files").addEventListener("change",async e=>{
  state.items=[];
  const errors=[];
  const okFiles=[];
  for(const f of e.target.files){
    try{
      const data=JSON.parse(await f.text());
      const check=detectSchema(data);
      if(!check.ok){
        errors.push({file:f.name,message:check.error});
        continue;
      }
      const count=addData(f.name,data);
      okFiles.push(`${f.name} (${count} entradas)`);
    }catch(err){
      errors.push({file:f.name,message:"JSON inválido: não foi possível interpretar o conteúdo."});
    }
  }

  rebuild();

  $("#fileNames").textContent=okFiles.length
    ? okFiles.join(" • ")
    : "Nenhum JSON compatível carregado";

  const errorsBox=$("#errors");
  errorsBox.innerHTML="";
  if(errors.length){
    const box=document.createElement("div");
    box.id="errorBox";
    const title=document.createElement("strong");
    title.textContent="⚠️ Alguns arquivos não puderam ser carregados";
    box.append(title);
    for(const e of errors){
      const p=document.createElement("div");
      p.style.marginTop="8px";
      p.textContent=`${e.file}: ${e.message}`;
      box.append(p);
    }
    const p=document.createElement("p");
    p.textContent="Exemplo de estrutura aceita:";
    box.append(p);
    const code=document.createElement("code");
    code.textContent=exampleJSON();
    box.append(code);
    errorsBox.append(box);
  }else if(okFiles.length){
    const box=document.createElement("div");
    box.className="successBox";
    box.textContent=`✅ ${okFiles.length} JSON(s) carregado(s) • ${state.groups.size} jogo(s) agrupado(s).`;
    errorsBox.append(box);
  }

  $("#status").textContent=
    "Os arquivos compatíveis foram combinados no catálogo. Você pode adicionar JSONs de outros jogos usando o mesmo formato.";
}); 

