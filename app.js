const $=i=>document.getElementById(i);
const S={dest:null,route:null,idx:1,cued:{},pos:null,wid:null,paused:false,navOn:false,hs:null,hsAt:0,linked:false,diagOk:false,said:{},orientAt:0,lastFix:0};
const say=t=>{$('live').textContent=t;try{speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(t))}catch(e){}};
function show(v){document.querySelectorAll('.view').forEach(e=>e.classList.toggle('on',e.id=='v-'+v));
 const g={route:'home',nav:'home',arrive:'home'}[v]||v;
 document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.v==g));
 const h=$('v-'+v).querySelector('h2');h.tabIndex=-1;h.focus();scrollTo(0,0);if(v=='setup')setup()}
const AL={};
function alertSet(k,m){if(m){if(AL[k]!==m){AL[k]=m;if(!S.said[k]||Date.now()-S.said[k]>20000){say(m);S.said[k]=Date.now()}}}else delete AL[k];
 $('alerts').innerHTML=Object.values(AL).map(m=>`<div class="alert">${m}</div>`).join('')}

// ---------- hub link: Web Bluetooth ----------
const U=n=>'c0de5e50-0001-4a1b-9c3d-5e7a1c0b00'+n,SVC=U('aa');
let dev,chC,seq=0;const wait={};
async function link(){const g=await dev.gatt.connect(),s=await g.getPrimaryService(SVC);
 chC=await s.getCharacteristic(U('ab'));
 const st=await s.getCharacteristic(U('ac'));await st.startNotifications();
 st.addEventListener('characteristicvaluechanged',e=>onState(e.target.value));
 const rs=await s.getCharacteristic(U('ad'));await rs.startNotifications();
 rs.addEventListener('characteristicvaluechanged',e=>{const v=e.target.value,q=v.getUint8(0);if(wait[q]){wait[q]({suppressed:!!v.getUint8(1),delivered:v.getUint8(2)});delete wait[q]}});
 S.linked=true;say('Hub connected.')}
async function connectHub(){
 if(!navigator.bluetooth){say('Bluetooth is not supported in this browser. Use Chrome on Android.');return}
 try{dev=await navigator.bluetooth.requestDevice({filters:[{services:[SVC]}]});
  dev.addEventListener('gattserverdisconnected',()=>{S.linked=false;say('Hub disconnected. Reconnecting.');retry()});await link()}
 catch(e){say('Could not connect to the hub. Make sure it is powered and Bluetooth and location are on.')}}
async function retry(){for(let i=0;i<15&&!S.linked;i++){try{await link()}catch(e){await new Promise(r=>setTimeout(r,2000))}}}
function onState(v){const f=v.getUint8(10);
 S.hs={heading:v.getUint16(0,true)/10,headingAgeMs:v.getUint16(2,true),magCal:v.getUint8(4),distMm:v.getUint16(5,true),distAgeMs:v.getUint16(7,true),
  activePrio:v.getUint8(9),bno:!!(f&1),tof:!!(f&2),left:!!(f&4),right:!!(f&8),sup:v.getUint8(11)};S.hsAt=Date.now()}
const cmd=(op,a,b)=>new Promise((res,rej)=>{if(!S.linked)return rej(Error('no hub'));const q=++seq&255;wait[q]=res;
 chC.writeValueWithoutResponse(new Uint8Array([q,op,a,b])).catch(rej);
 setTimeout(()=>{if(wait[q]){delete wait[q];rej(Error('timeout'))}},3000)});
const test=(s,p)=>cmd(1,s,p);
const EV=['left','right','orientl','orientr','obstacle','urgent'],ev=t=>cmd(2,EV.indexOf(t),0);
const fresh=()=>S.linked&&Date.now()-S.hsAt<3000;

// ---------- status + alerts ----------
function poll(){const h=fresh()?S.hs:null,nav=S.navOn,P=[];
 P.push(['Hub',h?'ok':'bad',h?'on':'off']);
 if(h){P.push(['L',h.left?'ok':'bad',h.left?'on':'off'],['R',h.right?'ok':'bad',h.right?'on':'off']);
  const stale=h.distAgeMs>1000;P.push(['Sensors',stale||!h.tof?'warn':'ok',stale?'stale':'ok']);
  $('arbLive').textContent='Active cue priority: '+(h.activePrio||'none')+'. Cues suppressed so far: '+h.sup}
 P.push(['GPS',S.pos?(S.pos.acc<=30?'ok':'warn'):'bad',S.pos?'±'+Math.round(S.pos.acc)+'m':'off']);
 $('pills').innerHTML=P.map(([n,c,t])=>`<span class="pill ${c}">${n}: ${t}</span>`).join('');
 alertSet('hub',!h&&(nav||S.diagOk)?'Hub disconnected. Haptic cues and sensors are not active. I cannot verify the path.':null);
 if(h){alertSet('bl',nav&&!h.left?'Left bracelet disconnected.':null);alertSet('br',nav&&!h.right?'Right bracelet disconnected.':null);
  alertSet('tof',nav&&h.distAgeMs>1000?'Obstacle sensor data is stale. This does not mean the path is clear.':null);
  alertSet('obs',h.distAgeMs<500&&h.distMm<600?`Obstacle detected about ${Math.round(h.distMm/10)} centimetres ahead.`:null);
  alertSet('cal',nav&&h.magCal<2?'Compass not calibrated. Direction cues may be wrong.':null)}
 alertSet('gps',nav&&Date.now()-S.lastFix>10000?'GPS signal lost. Route guidance may be wrong.':null)}
setInterval(poll,1000);poll();

// ---------- destination + routing (OpenRouteService) ----------
const ORS='https://api.openrouteservice.org',key=()=>localStorage.getItem('ors')||'';
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!SR){$('mic').disabled=true;$('micnote').textContent='Voice input is not supported in this browser. Type the destination.'}
else $('micnote').textContent='Voice input uses your browser speech service (needs internet).';
$('mic').onclick=()=>{const r=new SR();say('Where would you like to go?');
 r.onresult=e=>{$('dest').value=e.results[0][0].transcript;say(`You said ${$('dest').value}. Is that correct? Press confirm, or say it again.`)};
 r.onerror=()=>say('I did not catch that. Please try again or type it.');setTimeout(()=>r.start(),1800)};
const upd=p=>(S.pos={lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy},S.lastFix=Date.now(),S.pos);
const getPos=()=>new Promise((ok,no)=>navigator.geolocation.getCurrentPosition(p=>ok(upd(p)),no,{enableHighAccuracy:true,timeout:15000}));
$('conf').onclick=async()=>{const q=$('dest').value.trim(),h=$('hstat');if(!q){say('Please enter a destination.');return}
 h.textContent='Finding route…';say('Finding a route to '+q);
 try{
  if(!key())throw 'Add your route service key in Setup first.';
  const o=await getPos().catch(()=>{throw 'Location unavailable. Allow location access for this site.'});
  const g=await fetch(`${ORS}/geocode/search?api_key=${key()}&text=${encodeURIComponent(q)}&focus.point.lon=${o.lon}&focus.point.lat=${o.lat}&size=1`).then(r=>r.json());
  const f=g.features&&g.features[0];if(!f)throw 'I could not find that place. Please try again.';
  const d={lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]};
  const r=await fetch(`${ORS}/v2/directions/foot-walking/geojson`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:key()},body:JSON.stringify({coordinates:[[o.lon,o.lat],[d.lon,d.lat]],instructions:true})});
  if(!r.ok)throw 'Route service error '+r.status+'. Navigation is unavailable.';
  const j=(await r.json()).features[0];
  S.route={geometry:j.geometry,coords:j.geometry.coordinates,summary:j.properties.summary,steps:j.properties.segments[0].steps};h.textContent='';
  $('rsum').textContent=`Destination: ${f.properties.label}. About ${Math.round(S.route.summary.distance)} metres, roughly ${Math.max(1,Math.round(S.route.summary.duration/60))} minutes.`;
  show('route');say($('rsum').textContent+' Press start journey when ready.');drawMap(o,d)
 }catch(e){const m=typeof e=='string'?e:'Route lookup failed. Check internet access.';h.textContent=m;say(m)}};
function drawMap(o,d){if(!window.L){$('map').textContent='Map unavailable.';return}
 if(S.map)S.map.remove();S.map=L.map('map');
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(S.map);
 const l=L.geoJSON(S.route.geometry).addTo(S.map);S.map.fitBounds(l.getBounds());
 L.circleMarker([o.lat,o.lon]).addTo(S.map);L.circleMarker([d.lat,d.lon],{color:'red'}).addTo(S.map)}

// ---------- device check ----------
const ask=q=>new Promise(res=>{say(q);$('ask').innerHTML=`<p>${q}</p><div class="row"><button id="y">Yes</button><button id="n" class="alt">No</button></div>`;
 $('y').onclick=()=>{$('ask').innerHTML='';res(true)};$('n').onclick=()=>{$('ask').innerHTML='';res(false)};$('y').focus()});
async function runCheck(){const out=[];S.diagOk=false;$('goOn').hidden=true;$('diag').innerHTML='';
 const add=(n,s,t)=>{out.push([n,s,t]);$('diag').innerHTML=out.map(([n,s,t])=>`<li class="${s}"><b>${n}</b>: ${t}</li>`).join('')};
 if(!fresh()){add('Hub','bad','not connected. Press Connect to CrossSense hub on the Go tab.');say('Hub not connected.');return}
 add('Hub','ok','connected');let all=true;
 for(const [s,n] of [[0,'Left'],[1,'Right']]){
  if(!S.hs[n.toLowerCase()]){add(n+' bracelet','bad','not connected to the hub');all=false;continue}
  await test(s,3).catch(()=>{});
  const y=await ask(`Testing the ${n.toLowerCase()} bracelet. Did you feel three clicks on your ${n.toLowerCase()} wrist?`);
  add(n+' bracelet',y?'ok':'bad',y?'connected, vibration confirmed by you':'command sent, vibration NOT confirmed');if(!y)all=false}
 const h=S.hs,bo=h.bno&&h.headingAgeMs<1000,to=h.tof&&h.distAgeMs<1000;
 add('Orientation sensor',!bo?'bad':h.magCal>=3?'ok':'warn',!bo?'unavailable':h.magCal>=3?'working, compass calibrated':`working, compass calibrating (${h.magCal}/3): wave the chest module in a figure eight`);
 add('Obstacle sensor',to?'ok':'bad',to?'working':'unavailable');
 all=all&&bo&&to;S.diagOk=all;$('goOn').hidden=!all;
 say(all?'All required checks passed.':'Some checks failed. Navigation is blocked until they pass.')}

// ---------- haptic language ----------
const PAT=[
 {n:'Turn left',s:0,p:2,d:'Double click, left wrist',t:[10,-8,10]},
 {n:'Turn right',s:1,p:2,d:'Double click, right wrist',t:[10,-8,10]},
 {n:'Obstacle warning',s:2,p:6,d:'Pulsing, both wrists',t:[30,-12,30]},
 {n:'Urgent hazard',s:2,p:5,d:'Long strong buzz, both wrists',t:[90,-6,90]},
 {n:'Orientation correction',s:0,p:8,d:'Short, short, long on the side to turn toward',t:[8,-8,8,-8,40]},
 {n:'System ready',s:2,p:1,d:'Single click, both wrists',t:[8]},
 {n:'Communication failure',s:2,p:4,d:'Two soft bumps, both wrists',t:[14,-10,14]}];
$('pats').innerHTML=PAT.map((c,i)=>`<div class="card"><b>${c.n}</b><div class="tl" aria-hidden="true">${c.t.map(w=>w>0?`<i style="width:${w}px"></i>`:`<b style="width:${-w}px"></b>`).join('')}</div>
 <small>${c.d}. Timeline is approximate.</small><button class="alt" onclick="tp(${i})">Test ${c.n}</button></div>`).join('');
const tp=i=>test(PAT[i].s,PAT[i].p).then(r=>say(r.delivered?PAT[i].n:'No bracelet received it')).catch(()=>say('Hub not connected'));
async function practice(){const i=Math.floor(Math.random()*5);
 try{await test(PAT[i].s,PAT[i].p)}catch(e){say('Hub not connected');return}
 say('Which cue was that?');
 $('prac').innerHTML=PAT.slice(0,5).map((c,j)=>`<button class="alt" onclick="say(${j==i}?'Correct, ${c.n}':'Not quite. It was ${PAT[i].n}')">${c.n}</button>`).join('')}

// ---------- navigation ----------
const rad=x=>x*Math.PI/180;
const hav=(a,[lo,la])=>{const x=Math.sin(rad(la-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(la))*Math.sin(rad(lo-a.lon)/2)**2;return 12742e3*Math.asin(Math.sqrt(x))};
const brg=(a,[lo,la])=>{const y=Math.sin(rad(lo-a.lon))*Math.cos(rad(la)),x=Math.cos(rad(a.lat))*Math.sin(rad(la))-Math.sin(rad(a.lat))*Math.cos(rad(la))*Math.cos(rad(lo-a.lon));return(Math.atan2(y,x)*180/Math.PI+360)%360};
// ORS step types: 0 L,1 R,2 sharp L,3 sharp R,4 slight L,5 slight R,6 straight,9 U-turn,10 arrive,12 keep L,13 keep R
const dir=s=>[0,2,4,12].includes(s.type)?'left':[1,3,5,13].includes(s.type)?'right':s.type==9?'uturn':s.type==10?'arrive':'straight';
const loc=s=>S.route.coords[s.way_points[0]],steps=()=>S.route.steps;
const ARW={left:'←',right:'→',straight:'↑',uturn:'↶',arrive:'⚑'};
function startNav(){if(!S.diagOk){say('The device check has not passed. Navigation is blocked.');show('check');return}
 S.navOn=true;S.idx=1;S.cued={};S.paused=false;$('pz').textContent='Pause guidance';
 S.wid=navigator.geolocation.watchPosition(onPos,()=>alertSet('gps','Location unavailable.'),{enableHighAccuracy:true,maximumAge:1000});
 const m=steps()[Math.min(1,steps().length-1)];show('nav');$('instr').textContent=m.instruction;say('Starting navigation. '+m.instruction)}
function onPos(p){upd(p);if(!S.navOn)return;
 const st=steps(),m=st[S.idx],d=hav(S.pos,loc(m)),last=S.idx==st.length-1;
 if(last&&d<20)return arrive();
 if(!last&&d<15){S.idx++;S.cued={};return onPos(p)}
 const x=dir(m);$('arrow').textContent=ARW[x];$('instr').textContent=m.instruction;$('dist').textContent=Math.round(d)+' metres';
 if(d<80&&!S.cued.a){S.cued.a=1;if(!S.paused)say(`In ${Math.round(d/10)*10} metres, ${m.instruction}`)}
 if(d<30&&!S.cued.c){S.cued.c=1;if(!S.paused&&(x=='left'||x=='right'))ev(x).catch(()=>{})}
 const h=S.hs;
 if(!S.paused&&fresh()&&h.magCal>=2&&h.headingAgeMs<1000&&d>20&&Date.now()-S.orientAt>5000){
  const e=((brg(S.pos,loc(m))-h.heading+540)%360)-180;
  if(Math.abs(e)>50){S.orientAt=Date.now();$('nline').textContent=e>0?'Turn right to face the route':'Turn left to face the route';ev(e>0?'orientr':'orientl').catch(()=>{})}
  else $('nline').textContent=''}}
function stopNav(){S.navOn=false;if(S.wid!=null)navigator.geolocation.clearWatch(S.wid);S.wid=null;say('Navigation stopped.')}
function arrive(){stopNav();show('arrive');say('You have reached your destination area. Would you like to stop navigation or choose another destination?')}
const repeat=()=>say(`${$('instr').textContent}. ${$('dist').textContent}.`);
function pause(){S.paused=!S.paused;$('pz').textContent=S.paused?'Resume guidance':'Pause guidance';say(S.paused?'Guidance paused. Obstacle warnings stay on.':'Guidance resumed.')}
function help(){$('helpbox').hidden=false;say('CrossSense cannot contact anyone for you. Ask a person nearby, or call your local emergency number yourself.')}
async function where(){if(!S.pos){say('Location not available.');return}
 try{const r=await fetch(`${ORS}/geocode/reverse?api_key=${key()}&point.lon=${S.pos.lon}&point.lat=${S.pos.lat}&size=1`).then(r=>r.json());
  say(`You are near ${r.features[0].properties.label}. Location accuracy about ${Math.round(S.pos.acc)} metres.`)}
 catch(e){say(`I could not look up your address. Location accuracy about ${Math.round(S.pos.acc)} metres.`)}}

// ---------- arbitration demo + setup ----------
async function arbDemo(){try{const o=await ev('obstacle'),l=await ev('left');
 $('arbOut').textContent=`Obstacle cue: ${o.suppressed?'suppressed':'sent to '+o.delivered+' bracelet(s)'}. Left-turn cue: ${l.suppressed?'suppressed by the higher-priority obstacle cue':'sent'}. It can be sent again after about 1.5 seconds.`;say($('arbOut').textContent)}
 catch(e){say('Hub not connected')}}
function setup(){$('net').textContent=fresh()?'Hub connected over Bluetooth':'Hub not connected';$('orskey').value=key()?'••••saved':'';
 $('caps').innerHTML=[['Secure page (GPS and microphone)',isSecureContext],['Bluetooth',!!navigator.bluetooth],['Speech output',!!window.speechSynthesis],['Voice input',!!SR],['Route key saved',!!key()]]
 .map(([n,o])=>`<li class="${o?'ok':'bad'}">${n}: ${o?'yes':'no'}</li>`).join('')}
function saveKey(){const v=$('orskey').value.trim();if(v&&!v.startsWith('•')){localStorage.setItem('ors',v);say('Key saved.')}setup()}
