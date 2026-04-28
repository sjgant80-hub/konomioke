var REPO='teslasolar/konomioke',LABEL='konomi-config';
var GH_TAGS=[],LOCAL_TAGS=[],SEL=null,TAB='gh';
var _INTERNAL=['_src','_issue','_title','_updated','_id','_isSys','_hasScript','_scriptLen','_file'];

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

function cleanTag(t){var c=Object.assign({},t);_INTERNAL.forEach(function(k){delete c[k]});return c}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function stat(v,l,c){return '<div class="stat"><div class="v" style="color:'+c+'">'+v+'</div><div class="l">'+l+'</div></div>'}
function prop(k,v){return '<span class="k">'+k+'</span><span class="val">'+(v??'—')+'</span>'}
