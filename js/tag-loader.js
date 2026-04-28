var KONOMI_REPO='teslasolar/konomioke',KONOMI_LABEL='konomi-config';
var KONOMI_TAGS=null;

async function fetchKonomiTags(){
  if(KONOMI_TAGS)return KONOMI_TAGS;
  try{
    var r=await fetch('https://api.github.com/repos/'+KONOMI_REPO+'/issues?labels='+KONOMI_LABEL+'&state=open&per_page=50',
      {headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(6000)});
    var issues=await r.json();
    KONOMI_TAGS=[];
    for(var iss of issues){
      var m=iss.body?.match(/```json\s*([\s\S]*?)```/);
      if(!m)continue;
      try{var tag=JSON.parse(m[1]);tag._issue=iss.number;KONOMI_TAGS.push(tag)}catch(e){}
    }
  }catch(e){KONOMI_TAGS=[]}
  return KONOMI_TAGS;
}

function findKonomiTag(id){
  if(!KONOMI_TAGS)return null;
  for(var t of KONOMI_TAGS)if(t.tag_id===id)return t;
  return null;
}

async function applyKonomiTags(){
  var tags=await fetchKonomiTags();
  var applied=0;
  for(var tag of tags){
    if(!tag.tag_id)continue;
    // System tags: execute script globally
    if(tag.tag_id.startsWith('_')&&tag.script){
      try{new Function(tag.script)()}catch(e){console.warn('tag '+tag.tag_id+':',e.message)}
      applied++;continue;
    }
    // Element tags: target by id or selector
    var el=tag.target?document.querySelector(tag.target):document.getElementById(tag.tag_id);
    if(!el)continue;
    if(tag.content)el.innerHTML=tag.content;
    if(tag.script){
      try{new Function('el',tag.script)(el)}catch(e){console.warn('tag '+tag.tag_id+':',e.message)}
    }
    if(tag.style)Object.assign(el.style,tag.style);
    applied++;
  }
  return applied;
}
