var REPO='teslasolar/konomioke',LABEL='konomi-config';
var GH_TAGS=[],LOCAL_TAGS=[],ALL=[],SEL=null,TAB='gh';

var LOCAL_FILES=['_types','app','audio','identity','mesh','mining','modules',
  'phases','platform','rings','state-machine','tracks','views','viz','vocal'];

async function fetchGH(){
  var r=await fetch('https://api.github.com/repos/'+REPO+'/issues?labels='+LABEL+'&state=open&per_page=50',
    {headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(8000)});
  var issues=await r.json();
  GH_TAGS=[];
  for(var iss of issues){
    var m=iss.body?.match(/```json\s*([\s\S]*?)```/);
    if(!m)continue;
    try{var tag=JSON.parse(m[1]);tag._src='gh';tag._issue=iss.number;tag._title=iss.title;
      tag._updated=iss.updated_at;tag._id=tag.tag_id||tag.cell_id||tag._udt||'?';
      tag._isSys=tag._id.startsWith('_');tag._hasScript=!!tag.script;
      tag._scriptLen=tag.script?.length||0;GH_TAGS.push(tag)}catch(e){}}
  GH_TAGS.sort(function(a,b){return a._id.localeCompare(b._id)});
}

async function fetchLocal(){
  LOCAL_TAGS=[];
  for(var f of LOCAL_FILES){
    try{var r=await fetch('tags/'+f+'.json');var j=await r.json();
      j._src='local';j._file=f+'.json';j._id=j._udt||f;LOCAL_TAGS.push(j)}catch(e){}}
}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function stat(v,l,c){return '<div class="stat"><div class="v" style="color:'+c+'">'+v+'</div><div class="l">'+l+'</div></div>'}
function prop(k,v){return '<span class="k">'+k+'</span><span class="val">'+(v??'—')+'</span>'}

function switchTab(t){TAB=t;SEL=null;
  document.getElementById('tab-gh').className='tab'+(t==='gh'?' active':'');
  document.getElementById('tab-local').className='tab'+(t==='local'?' active':'');
  renderSidebar();renderMain()}

function renderSidebar(){
  var list=TAB==='gh'?GH_TAGS:LOCAL_TAGS;
  document.getElementById('sidebar').innerHTML=list.map(function(t,i){
    var pills='';
    if(t._src==='gh')pills+='<span class="pill gh">GH#'+t._issue+'</span>';
    else pills+='<span class="pill loc">FILE</span>';
    if(t._isSys)pills+='<span class="pill sys">SYS</span>';
    if(t._hasScript)pills+='<span class="pill scr">JS</span>';
    return '<div class="tag-row'+(SEL===i?' sel':'')+'" onclick="selectTag('+i+')">'
      +'<span style="color:var(--ig);min-width:12ch;font-weight:600">'+esc(t._id)+'</span>'
      +'<span style="flex:1"></span>'+pills+'</div>'}).join('');
}

function renderMain(){
  var gh=GH_TAGS.length,loc=LOCAL_TAGS.length;
  var scripts=GH_TAGS.filter(function(t){return t._hasScript}).length;
  var jsBytes=GH_TAGS.reduce(function(s,t){return s+t._scriptLen},0);
  document.getElementById('main').innerHTML='<div class="stats-row">'
    +stat(gh,'GH ISSUES','var(--ig)')+stat(loc,'LOCAL FILES','var(--gd)')
    +stat(gh+loc,'TOTAL','var(--ok)')+stat(scripts,'SCRIPTS','var(--wr)')
    +stat(jsBytes,'JS BYTES','#a080ff')+'</div>'
    +'<div class="detail"><h3>tag.db overview</h3>'
    +'<pre>'+esc('── GitHub Issues ('+LABEL+') ──\n'
      +GH_TAGS.map(function(t){return(t._isSys?'⚙':'◻')+' '+t._id.padEnd(20)+' #'+String(t._issue).padStart(2)
        +(t._hasScript?' JS:'+String(t._scriptLen).padStart(4):'')}).join('\n')
      +'\n\n── Local tags/ ──\n'
      +LOCAL_TAGS.map(function(t){return '📄 '+t._id.padEnd(20)+' '+t._file}).join('\n'))
    +'</pre></div>';
}

function selectTag(i){
  SEL=i;renderSidebar();
  var t=(TAB==='gh'?GH_TAGS:LOCAL_TAGS)[i];
  var clean=Object.assign({},t);
  ['_src','_issue','_title','_updated','_id','_isSys','_hasScript','_scriptLen','_file'].forEach(function(k){delete clean[k]});
  var main=document.getElementById('main');
  var propsHtml=prop('id',t._id);
  if(t._src==='gh'){propsHtml+=prop('issue','#'+t._issue)+prop('title',t._title)+prop('updated',t._updated?.slice(0,19).replace('T',' '))}
  else{propsHtml+=prop('file','tags/'+t._file)}
  if(t._udt)propsHtml+=prop('_udt',t._udt);
  if(t._hasScript)propsHtml+=prop('script',t._scriptLen+' bytes');
  main.innerHTML='<div class="detail"><h3>'+(t._src==='gh'?'#'+t._issue+' · ':'')+t._id+'</h3>'
    +'<div class="props">'+propsHtml+'</div>'
    +'<h3 style="margin-top:8px">JSON</h3><pre>'+esc(JSON.stringify(clean,null,2))+'</pre>'
    +(t._hasScript?'<h3 style="margin-top:8px">script</h3><pre>'+esc(t.script)+'</pre>':'')
    +'<div style="margin-top:6px;display:flex;gap:4px">'
    +'<button class="btn" onclick="copyTag('+i+')">⎘ copy</button>'
    +(t._src==='gh'?'<button class="btn" onclick="window.open(\'https://github.com/'+REPO+'/issues/'+t._issue+'\')">↗ github</button>':'')
    +'</div></div>';
}

function copyTag(i){
  var t=(TAB==='gh'?GH_TAGS:LOCAL_TAGS)[i];
  var c=Object.assign({},t);
  ['_src','_issue','_title','_updated','_id','_isSys','_hasScript','_scriptLen','_file'].forEach(function(k){delete c[k]});
  navigator.clipboard.writeText(JSON.stringify(c,null,2));
}
function copyAll(){
  var all=GH_TAGS.concat(LOCAL_TAGS).map(function(t){
    var c=Object.assign({},t);['_src','_issue','_title','_updated','_id','_isSys','_hasScript','_scriptLen','_file'].forEach(function(k){delete c[k]});return c});
  navigator.clipboard.writeText(JSON.stringify(all,null,2));
}

async function refresh(){
  document.getElementById('status').textContent='fetching...';
  try{await Promise.all([fetchGH(),fetchLocal()]);renderSidebar();renderMain();
    document.getElementById('status').textContent='✔ '+GH_TAGS.length+' issues · '+LOCAL_TAGS.length+' local'}
  catch(e){document.getElementById('status').innerHTML='<span style="color:var(--er)">✘ '+e.message+'</span>'}
}

setInterval(function(){var c=document.getElementById('clock');if(c)c.textContent=new Date().toLocaleTimeString()},1000);
refresh();
