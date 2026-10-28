// ---------- voice layer: everything is spoken and heard ----------
const SYN=window.speechSynthesis;let rec=null,cur=0,sid=0,lastUnk=0,stT;
S.voice=false;S.dm=null;S.prac=null;S.askRes=null;S.testing=false;
const curV=()=>document.querySelector('.view.on').id.slice(2);
const setMic=t=>{$('micstat').textContent='Mic: '+t};
const GUIDE={
 home:'Say go to, then a place, then say confirm. Say connect hub to connect the hub. Say devices, haptics, arbiter or setup to switch tabs.',
 check:'Say start check to begin. Say stop at any time.',
 haptics:'Say test turn left, test right, test obstacle, test urgent, test orientation, test ready or test failure. Say practice for a quiz, or list cues. Say stop to stop the vibration.',
 route:'Say start journey, change destination, or cancel.',
 nav:'Say repeat, where am I, pause, resume, help, call 112, change destination, or stop.',
 arrive:'Say choose another destination, or say done.',
 arb:'Say demo to run the arbitration demo, or read order to hear the priorities.',
 setup:'Say status to hear the setup status. Say save key to save the route key typed in the field.'};
document.querySelectorAll('.view').forEach(v=>v.querySelector('h2').insertAdjacentHTML('afterend',`<p class="hint">Say: ${GUIDE[v.id.slice(2)]}</p>`));

// speech output (mic is paused while speaking so the app does not hear itself)
function speak(t){$('live').textContent=t;return new Promise(res=>{
 try{SYN.cancel()}catch(e){}
 const id=++sid;cur=id;stopRec();setMic('speaking');let fin=false;
 const end=()=>{if(fin)return;fin=true;res();if(cur==id){cur=0;setTimeout(listen,300)}};
 try{const u=new SpeechSynthesisUtterance(t);u.onend=end;u.onerror=end;SYN.speak(u)}catch(e){end()}
 setTimeout(end,3000+t.length*90)})}
function stopRec(){if(rec){try{rec.abort()}catch(e){}}}
function listen(){if(!S.voice||cur||rec||!SR)return;
 const r=new SR();rec=r;r.lang='en-IN';r.interimResults=false;
 r.onresult=e=>handle(e.results[e.results.length-1][0].transcript);
 r.onerror=e=>{if(e.error=='not-allowed'||e.error=='service-not-allowed'){S.voice=false;$('start').hidden=false;speak('Microphone is blocked. Allow microphone access for this site, then tap the screen.')}};
 r.onend=()=>{if(rec===r)rec=null;if(!cur)setMic(S.voice?'off':'off');setTimeout(listen,300)};
 try{r.start();setMic('listening')}catch(e){rec=null}}

// stop button / safety: motors never keep running
function armStop(){S.testing=true;$('stopbar').hidden=false;clearTimeout(stT);stT=setTimeout(stopMotors,4000)}
async function stopMotors(){S.testing=false;$('stopbar').hidden=true;clearTimeout(stT);
 if(!chC||!S.linked)return;
 for(let i=0;i<3;i++){try{await chC.writeValueWithoutResponse(new Uint8Array([++seq&255,3,0,0]))}catch(e){}await new Promise(r=>setTimeout(r,80))}}
function doStop(){const was=S.testing;stopMotors();
 if(S.askRes){const r=S.askRes;S.askRes=null;$('ask').innerHTML='';r(null);return}
 if(S.navOn){stopNav();show('home');return}
 S.prac=null;S.dm=null;speak(was?'Test stopped.':'Stopped.')}
addEventListener('pagehide',stopMotors);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMotors();else listen()});

// tabs
function tab(v){show(v);if(v=='home')S.dm='dest';speak($('v-'+v).querySelector('h2').textContent+'. '+GUIDE[v])}
function askDest(){S.dm='dest';show('home');speak('Where would you like to go?')}
function setDest(x){let c=false;x=x.replace(/\s+(?:and )?confirm$/,()=>(c=true,'')).trim();if(!x)return;
 $('dest').value=x;if(curV()!='home')show('home');
 if(c){S.dm=null;confirmDest()}else{S.dm='confirm';speak(`You said ${x}. Say confirm to go there, or say the destination again.`)}}

// hub: Bluetooth needs one screen tap the first time (browser rule); after that voice reconnects
async function hubVoice(){
 if(!navigator.bluetooth){speak('Bluetooth is not supported in this browser. Use Chrome on Android.');return}
 if(S.linked){speak('Hub is already connected.');return}
 if(dev){try{await link();return}catch(e){}}
 speak('Tap anywhere on the screen once, then choose CrossSense from the list. A helper may need to pick it.');
 document.addEventListener('click',()=>connectHub(),{once:true,capture:true})}
async function autoHub(){try{const d=navigator.bluetooth&&navigator.bluetooth.getDevices&&(await navigator.bluetooth.getDevices())[0];
 if(d){dev=d;dev.addEventListener('gattserverdisconnected',()=>{S.linked=false;speak('Hub disconnected. Reconnecting.');retry()});await link()}}catch(e){}}

// command router
const norm=s=>s.toLowerCase().replace(/[^a-z0-9' ]/g,' ').replace(/\s+/g,' ').trim();
const YES=/^(yes|yeah|yep|yup|correct|i did|i felt it|i felt them|sure|ok|okay)$/,NO=/^(no|nope|nah|i didn't|i did not|didn't|nothing|i felt nothing)$/;
const cueOf=t=>/orient|correction/.test(t)?4:/urgent|hazard/.test(t)?3:/obstacle|warning/.test(t)?2:/ready|system/.test(t)?5:/fail|communication/.test(t)?6:/left/.test(t)?0:/right/.test(t)?1:-1;
function startJourney(){if(!S.route)return speak('There is no route yet. Say go to, then a place.');
 if(!S.diagOk){speak('The device check has not passed. Starting the device check.');show('check');return runCheck()}startNav()}
function handle(raw){const t=norm(raw);if(!t)return;$('heard').textContent='Heard: '+raw;
 const v=curV(),nav=v=='nav';
 if(/^(please )?(stop|halt|enough)( (the )?(test|testing|motors?|vibrations?|vibrating|navigation|everything|now|it))?$/.test(t))return doStop();
 if(S.askRes){const y=YES.test(t),n=NO.test(t);if(!y&&!n)return speak('Please say yes or no, or say stop.');
  const r=S.askRes;S.askRes=null;$('ask').innerHTML='';return r(y)}
 if(S.prac!=null){if(/skip|give up|cancel|exit/.test(t)){S.prac=null;return speak('Skipped.')}
  let k=cueOf(t);if(k<0||k>4)return speak('Say turn left, turn right, obstacle, urgent, or orientation.');
  const i=S.prac;S.prac=null;return speak(k==i?'Correct, '+PAT[i].n+'. Say practice for another.':'Not quite. It was '+PAT[i].n+'. Say practice to try again.')}
 if(v=='home'&&S.dm=='confirm'){
  if(/^(confirm|yes|yeah|yep|correct|go|ok|okay|that's right|that is right)$/.test(t)){S.dm=null;return confirmDest()}
  if(NO.test(t)||/^(cancel|change|again|wrong)$/.test(t)){S.dm='dest';return speak('Okay. Where would you like to go?')}}
 const tb=t.match(/^(?:go to |open |show |switch to )?(?:the )?(home|devices?|device check|haptics?|haptic language|haptic practice|arbiter|arbiter engine|arbitration|setup|settings)(?: tab| screen| page)?$/);
 if(tb){if(nav)return speak('Say stop to end navigation first.');const k=tb[1];return tab(/^dev/.test(k)?'check':/^hap/.test(k)?'haptics':/^arb/.test(k)?'arb':/^set/.test(k)?'setup':'home')}
 const dm=t.match(/^(?:please )?(?:i (?:want|need|would like) to go to|take me to|navigate to|walk to|route me to|directions to|go to|destination is|destination)\s+(.+)$/);
 if(dm&&!nav)return setDest(dm[1]);
 if(/^(connect|reconnect|pair)\b.*(hub|bluetooth|crosssense|device)/.test(t))return hubVoice();
 if(/^(hello|hi|greeting|greet me)$/.test(t))return speak('Hello, welcome to CrossSense. Where would you like to go?');
 if(/^(status|read status|system status)$/.test(t))return speak(`Hub ${fresh()?'connected':'not connected'}. Location ${S.pos?'accurate to '+Math.round(S.pos.acc)+' metres':'not available'}. Route key ${key()?'saved':'missing'}.`);
 if(/^(commands|what can i say|options)$/.test(t)||(/^help$/.test(t)&&!nav))return speak(GUIDE[v]);
 if(/^(start|run|begin) (the |a )?(device )?(check|test)$|^check (my )?devices?$/.test(t)&&!nav){show('check');return runCheck()}
 if(/^(start|begin) (the |my )?(journey|navigation|trip)$/.test(t)&&!nav)return startJourney();
 if(/^(continue|next|haptic practice|go on)$/.test(t)&&v=='check'&&!$('goOn').hidden)return tab('haptics');
 if(v=='haptics'){const m=t.match(/^(?:test|play|try) (.+)$/);if(m){const k=cueOf(m[1]);if(k>=0)return tp(k)}
  if(/^(practice|quiz me|random cue|practice mode)$/.test(t))return practice();
  if(/^(list|read|describe)\b.*(cues?|patterns?|haptics?)$/.test(t))return speak(PAT.map(c=>c.n+': '+c.d).join('. '))}
 if(v=='arb'){if(/demo/.test(t))return arbDemo();if(/^(read|explain|priority|order|priorities)\b/.test(t))return speak('Priority order. 1, emergency or critical hazard. 2, obstacle proximity. 3, navigation instruction. 4, orientation correction. 5, routine confirmation. Lower number wins.')}
 if(v=='setup'&&/^save( the| my)?( route)?( service)? key$/.test(t))return saveKey();
 if(v=='route'){if(/^(start|begin|go)$/.test(t))return startJourney();if(/^(repeat|read route)$/.test(t))return speak($('rsum').textContent)}
 if(v=='route'||v=='arrive'||nav){if(/^(change( destination)?|cancel|another destination|choose another destination|new destination)$/.test(t)||(v=='arrive'&&t=='yes')){if(nav)stopNav();return askDest()}
  if(v=='arrive'&&/^(done|finish|no|stop navigation)$/.test(t)){show('home');return speak('Navigation ended.')}}
 if(nav){if(/^(repeat|say again)$/.test(t))return repeat();if(/where am i|my location/.test(t))return where();
  if(/^pause( guidance)?$/.test(t))return S.paused||pause();if(/^resume( guidance)?$/.test(t))return S.paused&&pause();
  if(/^(help|emergency)$/.test(t))return help();
  if(/^call (112|emergency)$/.test(t)){speak('Opening the phone dialler. You must press call yourself.');return void(location.href='tel:112')}
  return}
 if(v=='home'&&S.dm){if(t=='confirm')return speak('Tell me the destination first. Say go to, then a place.');return setDest(t)}
 if(Date.now()-lastUnk>8000){lastUnk=Date.now();speak("I didn't understand. Say help to hear what you can say.")}}

// start: one tap anywhere is required by the browser to allow sound and microphone
function go(){if(S.voice)return;S.voice=true;$('start').hidden=true;S.dm='dest';
 try{navigator.wakeLock&&navigator.wakeLock.request('screen')}catch(e){}
 speak(SR?'Welcome to CrossSense. Voice control is on. Where would you like to go? Say go to, then a place. Say help at any time.':'Voice input is not supported in this browser. Use Chrome on Android.');autoHub()}
$('start').addEventListener('click',go);
$('start').addEventListener('keydown',e=>{if(e.key=='Enter'||e.key==' ')go()});
$('start').focus();
