// arena.js — Three.js scene: floor, target, aura, vortex, stars
var W,H,scene,camera,renderer,clock;
var aura,auraGlow,target,vortexGroup,vortexPos,vortexCol,VORTEX_N=600;
var camAngle=0,screenShake=0;
function initScene(){
  W=window.innerWidth;H=window.innerHeight;scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x000011,0.012);
  camera=new THREE.PerspectiveCamera(60,W/H,0.1,500);camera.position.set(0,3.5,9);camera.lookAt(0,2,-4);
  renderer=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:true,alpha:true});
  renderer.setSize(W,H);renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;clock=new THREE.Clock();
  window.onresize=function(){W=innerWidth;H=innerHeight;camera.aspect=W/H;camera.updateProjectionMatrix();renderer.setSize(W,H)};
  // stars
  var sg=new THREE.BufferGeometry(),sp=new Float32Array(3000*3);
  for(var i=0;i<3000;i++){sp[i*3]=(Math.random()-.5)*300;sp[i*3+1]=(Math.random()-.5)*300;sp[i*3+2]=(Math.random()-.5)*300;}
  sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
  scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:0.4})));
  // floor
  var floor=new THREE.Mesh(new THREE.CircleGeometry(18,64),new THREE.MeshBasicMaterial({color:0x0a0a3a,transparent:true,opacity:0.6}));
  floor.rotation.x=-Math.PI/2;scene.add(floor);scene.add(new THREE.GridHelper(36,36,0x003366,0x001133));
  // target
  target=new THREE.Mesh(new THREE.IcosahedronGeometry(1.8,2),new THREE.MeshBasicMaterial({color:0xff2222,wireframe:true,transparent:true,opacity:0.8}));
  target.position.set(0,2.5,-8);scene.add(target);
  target.add(new THREE.Mesh(new THREE.SphereGeometry(1.4,16,16),new THREE.MeshBasicMaterial({color:0xff4444,transparent:true,opacity:0.15,blending:THREE.AdditiveBlending,depthWrite:false})));
  target.hpRing=new THREE.Mesh(new THREE.TorusGeometry(2.2,0.06,8,64),new THREE.MeshBasicMaterial({color:0xff0000,transparent:true,opacity:0.6}));target.add(target.hpRing);
  // aura
  aura=new THREE.Mesh(new THREE.SphereGeometry(1,16,16),new THREE.MeshBasicMaterial({color:0x4488ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  aura.position.set(0,2.5,5);scene.add(aura);
  auraGlow=new THREE.Mesh(new THREE.SphereGeometry(1.5,12,12),new THREE.MeshBasicMaterial({color:0x2244aa,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  aura.add(auraGlow);initVortex();scene.add(new THREE.AmbientLight(0x222244,0.5));}
function initVortex(){vortexGroup=new THREE.Group();scene.add(vortexGroup);
  var geo=new THREE.BufferGeometry();vortexPos=new Float32Array(VORTEX_N*3);vortexCol=new Float32Array(VORTEX_N*3);
  for(var i=0;i<VORTEX_N;i++){var a=i*.15,r=3+i*.025;vortexPos[i*3]=Math.cos(a)*r;vortexPos[i*3+1]=(i/VORTEX_N-.5)*6;vortexPos[i*3+2]=Math.sin(a)*r;vortexCol[i*3]=.2;vortexCol[i*3+1]=.4;vortexCol[i*3+2]=.8;}
  geo.setAttribute('position',new THREE.BufferAttribute(vortexPos,3));geo.setAttribute('color',new THREE.BufferAttribute(vortexCol,3));
  vortexGroup.add(new THREE.Points(geo,new THREE.PointsMaterial({size:.15,vertexColors:true,transparent:true,opacity:.4,blending:THREE.AdditiveBlending,depthWrite:false})));vortexGroup.position.set(0,2.5,-1.5);}
function hslRgb(h,s,l){var r,g,b;if(!s){r=g=b=l}else{function h2r(p,q,t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<.5)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p}
  var q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;r=h2r(p,q,h+1/3);g=h2r(p,q,h);b=h2r(p,q,h-1/3)}return[r,g,b]}
