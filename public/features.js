import { recoveryWorkspace } from './recovery-workspace.js';
export function createFeatureViews({ state, icon, escape, dateLabel, pageHeading, empty, button, formError, api, submit, savedProgress, renderApp, toast, scrollTop }) {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const categories = { courage: 'A brave moment', movement: 'Movement', self_kindness: 'Self-kindness', gratitude: 'Gratitude', other: 'A little victory' };
  const data = () => state.data;
  const fearRows = () => data().fear_entries || [];
  const steps = () => data().ladder_steps || [];
  const wins = () => data().micro_wins || [];
  const intensity = score => score === 0 ? 'Feeling settled' : score <= 3 ? 'A little unease' : score <= 6 ? 'Noticeable fear' : score < 10 ? 'Strong fear' : 'Very intense fear';
  const heat = score => score <= 3 ? 'low' : score <= 6 ? 'medium' : 'high';
  const dateField = date => `<label>Date<input type="date" name="entry_date" value="${escape(date)}" max="${data().today}" min="2000-01-01" required></label>`;
  const actions = (type, entry) => `<div class="entry-actions"><button type="button" class="icon-btn" data-feature-edit="${type}" data-entry-id="${entry.id}" aria-label="Edit entry">${icon('edit')}</button><button type="button" class="icon-btn" data-delete="${type}/${entry.id}" aria-label="Delete entry">${icon('trash')}</button></div>`;
  function thermometer(score) {
    const fill = ({low:'#8ba77b',medium:'#d2b56f',high:'#c49175'})[heat(score)];
    return `<svg class="fear-thermometer" viewBox="0 0 150 280" role="img" aria-label="Your fear rating: ${score} out of 10"><defs><clipPath id="thermometer-clip"><rect x="59" y="24" width="32" height="210" rx="16"/></clipPath></defs><rect x="51" y="16" width="48" height="224" rx="24" fill="#fff" stroke="#dce4d3" stroke-width="2"/><rect x="59" y="24" width="32" height="210" rx="16" fill="#edf1e7"/><rect id="thermometer-fill" x="59" y="${234-score*21}" width="32" height="${score*21}" fill="${fill}" clip-path="url(#thermometer-clip)"/><circle id="thermometer-bulb" cx="75" cy="240" r="25" fill="${fill}" stroke="#fff" stroke-width="7"/>${[0,2,4,6,8,10].map(value=>`<line x1="104" x2="112" y1="${234-value*21}" y2="${234-value*21}" stroke="#b2bda5"/><text x="121" y="${238-value*21}" fill="#76896a" font-size="11">${value}</text>`).join('')}</svg>`;
  }
  function fearPage() {
    const entry = fearRows().find(x=>x.id===state.fearEdit), score = entry?.before_score ?? 5;
    return `${pageHeading('NAME IT. NOTICE IT.','Fear thermometer','A moment to notice fear, without judging it. Save as often as you need.')}<div class="fear-layout"><aside class="card thermometer-panel"><span class="eyebrow">MY FEAR, RIGHT NOW</span>${thermometer(score)}<div class="thermometer-number"><strong id="fear-live-score">${score}</strong><span>/ 10</span></div><p id="fear-live-label">${intensity(score)}</p><div class="gentle-reminder">${icon('heart')} A feeling is information, not a grade.</div></aside><form id="fear-form" class="card form-card"><div class="card-heading"><div><h2>${entry ? 'Update a moment' : 'Check in with the feeling'}</h2><p>Your ratings are personal. Every level belongs here.</p></div>${entry ? '<button class="text-button" type="button" data-cancel-feature="fear">Cancel edit</button>' : ''}</div>${dateField(entry?.entry_date || data().today)}<label>Movement or situation<input name="movement" maxlength="120" required value="${escape(entry?.movement || '')}" placeholder="For example: thinking about a change of direction"></label><div class="slider-section"><div class="slider-heading"><div><label for="fear-before">How much fear do you notice?</label><p>0 means no fear; 10 means very intense fear.</p></div><output id="fear-before-output" for="fear-before">${score}<small>/10</small></output></div><input id="fear-before" class="range fear-range" name="before_score" type="range" min="0" max="10" step="1" value="${score}"><div class="range-labels"><span>0 · No fear</span><span>10 · Very intense</span></div></div><label>What was happening? <span class="optional">(optional)</span><textarea name="context" rows="2" maxlength="500" placeholder="A little context for this moment…">${escape(entry?.context || '')}</textarea></label><label class="checkbox-label"><input id="include-after" type="checkbox" ${entry?.after_score != null ? 'checked' : ''}> Add a second rating for afterwards</label><div id="after-rating" ${entry?.after_score != null ? '' : 'hidden'}><div class="slider-heading"><label for="fear-after">Fear afterwards</label><output id="fear-after-output" for="fear-after">${entry?.after_score ?? 5}<small>/10</small></output></div><input id="fear-after" class="range fear-range" name="after_score" type="range" min="0" max="10" step="1" value="${entry?.after_score ?? 5}"><div class="range-labels"><span>0 · No fear</span><span>10 · Very intense</span></div></div><label>What helped, or what did you notice? <span class="optional">(optional)</span><textarea name="support" rows="2" maxlength="1500" placeholder="A pause, a supportive person, or a thought worth remembering…">${escape(entry?.support || '')}</textarea></label>${formError()}<button class="btn btn-primary full" type="submit">${entry ? 'Update fear entry' : 'Save fear entry'}${icon('check')}</button></form></div><section class="card feature-history"><div class="card-heading"><div><h2>Moments you have noticed</h2><p>Before and afterwards can look different. Both are useful to remember.</p></div><span class="pill soft-green">${fearRows().length} entries</span></div>${fearHistory(fearRows())}</section>`;
  }
  function fearHistory(rows, readOnly=false) {
    if(!rows.length)return empty('thermometer','A little awareness starts here.','Your saved fear ratings will appear here.');
    return `<div class="feature-records">${rows.map(entry=>`<article class="feature-record"><div class="history-entry-head"><div><span class="entry-date">${dateLabel(entry.entry_date,{day:'numeric',month:'short',year:'numeric'})}</span><span class="pill heat-${heat(entry.before_score)}">${intensity(entry.before_score)}</span></div>${readOnly?'':actions('fear-entries',entry)}</div><h3>${escape(entry.movement)}</h3><div class="fear-rating-pair"><span>First rating <strong>${entry.before_score}/10</strong></span>${entry.after_score!==null?`${icon('arrow')}<span>Afterwards <strong>${entry.after_score}/10</strong></span>`:''}</div>${entry.context?`<p class="entry-notes">${escape(entry.context)}</p>`:''}${entry.support?`<p class="entry-win">${icon('heart')}${escape(entry.support)}</p>`:''}</article>`).join('')}</div>`;
  }
  function ladderPage() {
    return recoveryWorkspace({state,data:data(),icon,escape,dateLabel,pageHeading,formError,dateField,ladderList});
  }
  function ladderList(rows,readOnly=false) {
    if(!rows.length)return empty('ladder','A path you can make your own.','Add a small goal to start your ladder. You can change it along the way.');
    return `<ol class="ladder-steps">${rows.map((entry,index)=>`<li class="ladder-step status-${entry.status}"><span class="ladder-rung">${entry.status==='complete'?icon('check'):index+1}</span><article><div class="history-entry-head"><span class="step-status">${({planned:'Planned',working:'Planned',complete:'Done'})[entry.status]}</span>${readOnly?'':actions('ladder-steps',entry)}</div><h3>${escape(entry.title)}</h3>${entry.description?`<p class="entry-notes">${escape(entry.description)}</p>`:''}<div class="step-meta"><span>${icon('thermometer')} Expected fear ${entry.expected_fear}/10</span>${entry.completed_date?`<span>${icon('checkcircle')} ${dateLabel(entry.completed_date)}</span>`:''}</div>${readOnly?'':`<div class="step-buttons"><button type="button" class="btn btn-light" data-step-status="${entry.id}" data-status="${entry.status==='complete'?'planned':'complete'}">${entry.status==='complete'?'Plan again':'Mark done'}${icon(entry.status==='complete'?'plus':'check')}</button><div class="step-order"><button class="icon-btn" type="button" data-step-move="${entry.id}" data-direction="-1" ${index===0?'disabled':''} aria-label="Move step earlier">${icon('up')}</button><button class="icon-btn" type="button" data-step-move="${entry.id}" data-direction="1" ${index===rows.length-1?'disabled':''} aria-label="Move step later">${icon('down')}</button></div></div>`}</article></li>`).join('')}</ol>`;
  }
  function comparisonPage() {
    const comparison=data().comparison;
    if(!comparison)return pageHeading('YOUR OWN YESTERDAY IS THE COMPARISON.','Me vs last month','Your recorded patterns will appear here after your next check-in.');
    const {current,previous}=comparison;
    const value=v=>v===null?'—':String(v);
    const trend=(key,unit)=>{
      if(current[key]===null||previous[key]===null)return 'Needs entries in both months';
      const difference=Math.round((current[key]-previous[key])*10)/10;
      return difference===0?'The same recorded average':`${Math.abs(difference)} ${unit} ${difference>0?'higher':'lower'}`;
    };
    const averageCard=(key,title,symbol,note)=>`<article class="card comparison-average"><span class="prompt-icon ${key==='fear'?'peach':'green'}">${icon(symbol)}</span><h2>${title}</h2><div class="comparison-values"><div><span>This month</span><strong>${value(current[key])}<small>/10</small></strong></div><span class="comparison-vs">vs</span><div><span>Last month</span><strong>${value(previous[key])}<small>/10</small></strong></div></div><div class="comparison-bars"><label>This month<meter min="0" max="10" value="${current[key]??0}" aria-label="${title}, this month: ${current[key]===null?'no data':current[key]+' out of 10'}"></meter></label><label>Last month<meter min="0" max="10" value="${previous[key]??0}" aria-label="${title}, last month: ${previous[key]===null?'no data':previous[key]+' out of 10'}"></meter></label></div><p class="comparison-delta">${trend(key,'points')}</p><p class="form-help">${note}</p></article>`;
    return `${pageHeading('YOUR OWN YESTERDAY IS THE COMPARISON.','Me vs last month','A little perspective on your patterns. Progress is allowed to look different each month.')}<div class="comparison-periods"><span>${icon('calendar')} <strong>This month</strong> ${dateLabel(current.start)} – ${dateLabel(current.end,{day:'numeric',month:'short',year:'numeric'})}</span><span><strong>Last month</strong> ${dateLabel(previous.start)} – ${dateLabel(previous.end,{day:'numeric',month:'short',year:'numeric'})}</span></div><p class="comparison-explanation">Month to date compared with the same dates last month. Shorter months are capped at their final day. Averages use saved daily check-ins; missing days are not counted as zero.</p><div class="comparison-grid">${averageCard('readiness','Psychological readiness','sprout','A higher rating means you reported feeling more ready.')}${averageCard('fear','Fear during movement','thermometer','A lower rating means you reported less fear. A higher rating does not erase earlier progress.')}</div><section class="card"><div class="card-heading"><div><h2>More than a score</h2><p>The moments of attention, reflection, and courage you recorded.</p></div>${icon('heart')}</div><div class="comparison-table-wrap"><table class="comparison-table"><thead><tr><th>What you recorded</th><th>This month</th><th>Last month</th></tr></thead><tbody>${[['checkin_days','Days you checked in'],['win_entries','Small-win entries'],['gratitude_entries','Gratitude entries'],['reframed_entries','Kinder perspectives'],['completed_steps','Ladder steps completed'],['fear_entries','Fear thermometer entries']].map(([key,label])=>`<tr><td>${label}</td><td>${current[key]}</td><td>${previous[key]}</td></tr>`).join('')}</tbody></table></div>${!previous.checkin_days?'<p class="inline-note">There are no daily check-ins in the previous comparison period yet. Your current entries are still worth keeping.</p>':''}</section><div class="comparison-kind-note">${icon('sprout')}<div><h2>You are a person, not a progress chart.</h2><p>Different days ask different things of you. Your journal holds the story behind these numbers.</p><a href="#micro-wins" class="text-link">Notice a small win ${icon('arrow')}</a></div></div>`;
  }
  function microWinsPage() {
    const entry=wins().find(x=>x.id===state.winEdit), rows=journalRows();
    const filtered=rows;
    return `${pageHeading('SMALL ENOUGH TO MISS. IMPORTANT ENOUGH TO KEEP.','Micro-win journal','A brave moment. A kind thought. A reason to be grateful. Make room for all of them.')}<div class="micro-journal-layout"><form id="micro-win-form" class="card form-card"><div class="card-heading"><div><h2>${entry?'Edit a little victory':'What is one small win?'}</h2><p>You can save more than one in a day.</p></div>${entry?'<button class="text-button" type="button" data-cancel-feature="win">Cancel edit</button>':icon('sparkles')}</div>${dateField(entry?.entry_date||data().today)}<label>A win I want to remember<textarea name="win" rows="3" maxlength="500" required placeholder="Today, I am giving myself credit for…">${escape(entry?.win||'')}</textarea></label><label>What kind of win was it?<select name="category">${Object.entries(categories).map(([key,label])=>`<option value="${key}" ${entry?.category===key?'selected':''}>${label}</option>`).join('')}</select></label><label>Why it matters to me <span class="optional">(optional)</span><textarea name="notes" rows="2" maxlength="1500" placeholder="It might look small, but for me it meant…">${escape(entry?.notes||'')}</textarea></label><details class="journal-extra" ${entry&&(entry.gratitude||entry.challenge)?'open':''}><summary>${icon('heart')} Add gratitude or a kinder perspective</summary><label>One thing I am grateful for<textarea name="gratitude" rows="2" maxlength="1500" placeholder="An ordinary thing that made today a little lighter…">${escape(entry?.gratitude||'')}</textarea></label><label>A thought that felt difficult<textarea name="challenge" rows="2" maxlength="1500" placeholder="Name the thought without judging it…">${escape(entry?.challenge||'')}</textarea></label><label>A more balanced perspective<textarea name="reframe" rows="2" maxlength="1500" placeholder="What might I say to a friend in this situation?">${escape(entry?.reframe||'')}</textarea></label><p class="form-help">If you add a difficult thought, add its kinder perspective too.</p></details><p class="form-help">Saved to your account. Administrators can view entries to support your progress.</p>${formError()}<button type="submit" class="btn btn-primary full">${entry?'Save journal changes':'Save my small win'}${icon('check')}</button></form><aside><div class="reflection-quote"><span class="quote-mark">“</span><h2>Sometimes a small win is simply being on your own side.</h2><span class="eyebrow">THAT COUNTS, TOO.</span>${icon('flower')}</div><div class="aside-tip">${icon('book')}<p>Your earlier check-in wins appear below. Your <a class="text-link" href="#journal">reflection journal</a> is still here, too.</p></div></aside></div><section class="card feature-history"><div class="card-heading"><div><h2>A collection of little victories</h2><p>${rows.length} saved win ${rows.length===1?'entry':'entries'}, including wins from daily check-ins.</p></div><label class="search-field">${icon('search')}<input id="win-search" type="search" value="${escape(state.winSearch||'')}" placeholder="Find a little victory" aria-label="Search small wins"></label></div><div id="micro-win-history">${microHistory(filtered)}</div></section>`;
  }
  function journalRows(source=data()) {
    return [...(source.micro_wins||[]).map(x=>({...x,source:'journal'})),...source.checkins.filter(x=>x.win).map(x=>({...x,category:'movement',source:'checkin'}))].sort((a,b)=>b.entry_date.localeCompare(a.entry_date)||(b.created_at||'').localeCompare(a.created_at||''));
  }
  function microHistory(rows,readOnly=false) {
    if(!rows.length)return empty('sparkles','A little victory belongs here.','Save a new win, or record one in your daily check-in.');
    return `<div class="reflection-list">${rows.map(entry=>`<article class="reflection-entry micro-win-entry"><div class="history-entry-head"><div><span class="entry-date">${dateLabel(entry.entry_date,{day:'numeric',month:'short',year:'numeric'})}</span><span class="pill soft-green">${entry.source==='checkin'?'Daily check-in':categories[entry.category]}</span></div>${readOnly?'':entry.source==='checkin'?`<button class="icon-btn" type="button" data-edit-checkin="${entry.entry_date}" aria-label="Edit check-in win">${icon('edit')}</button>`:actions('micro-wins',entry)}</div><h3>${icon('sparkles')}${escape(entry.win)}</h3>${entry.notes?`<p class="entry-notes">${escape(entry.notes)}</p>`:''}${entry.gratitude?`<div class="reflection-block"><span>${icon('heart')} GRATEFUL FOR</span><p>${escape(entry.gratitude)}</p></div>`:''}${entry.challenge?`<div class="reflection-block challenge"><span>THE DIFFICULT THOUGHT</span><p>${escape(entry.challenge)}</p></div><div class="reflection-block reframe"><span>${icon('sun')} A KINDER PERSPECTIVE</span><p>${escape(entry.reframe)}</p></div>`:''}</article>`).join('')}</div>`;
  }
  function homeCards() {
    const fear=fearRows()[0], ladder=steps(), count=ladder.filter(x=>x.status==='complete').length;
    return `<div class="home-tools">${[['fear','thermometer','Fear thermometer',fear?`Latest rating: ${fear.before_score}/10`:'Notice what comes up'],['ladder','ladder','Fear ladder',`${count} of ${ladder.length} steps complete`],['comparison','compare','Me vs last month','Your patterns, with perspective'],['micro-wins','book','Micro-win journal',`${journalRows().length} wins worth keeping`]].map(([route,symbol,title,note])=>`<a class="home-tool" href="#${route}"><span class="tool-icon">${icon(symbol)}</span><strong>${title}</strong><span>${note}</span>${icon('arrow')}</a>`).join('')}</div>`;
  }
  async function change(button, operation, message) {
    button.disabled=true;
    try {await savedProgress(await operation(),message);}catch(error){toast(error.message);button.disabled=false;}
  }
  function bindRecordActions() {
    $$('[data-feature-edit]').forEach(node=>node.addEventListener('click',()=>{
      const mapping={'fear-entries':['fearEdit','fear'],'ladder-steps':['ladderEdit','ladder'],'micro-wins':['winEdit','micro-wins']};
      const [key,route]=mapping[node.dataset.featureEdit];state[key]=node.dataset.entryId;state.route=route;renderApp();scrollTop();
    }));
    $$('[data-cancel-feature]').forEach(node=>node.addEventListener('click',()=>{state[({fear:'fearEdit',ladder:'ladderEdit',win:'winEdit'})[node.dataset.cancelFeature]]=null;renderApp();}));
  }
  function bind() {
    bindRecordActions();
    if(state.route==='fear') {
      $('#fear-before').addEventListener('input',event=>{
        const score=Number(event.target.value), fill=({low:'#8ba77b',medium:'#d2b56f',high:'#c49175'})[heat(score)];
        $('#fear-live-score').textContent=score;$('#fear-live-label').textContent=intensity(score);$('#fear-before-output').innerHTML=`${score}<small>/10</small>`;
        $('#thermometer-fill').setAttribute('y',234-score*21);$('#thermometer-fill').setAttribute('height',score*21);$('#thermometer-fill').setAttribute('fill',fill);$('#thermometer-bulb').setAttribute('fill',fill);$('.fear-thermometer').setAttribute('aria-label',`Your fear rating: ${score} out of 10`);
      });
      $('#include-after').addEventListener('change',event=>{$('#after-rating').hidden=!event.target.checked;});
      $('#fear-after').addEventListener('input',event=>{$('#fear-after-output').innerHTML=`${event.target.value}<small>/10</small>`;});
      $('#fear-form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;submit(form,async()=>{
        const body=Object.fromEntries(new FormData(form));body.before_score=Number(body.before_score);body.after_score=$('#include-after').checked?Number(body.after_score):null;
        const id=state.fearEdit,result=await api('/api/fear-entries'+(id?'/'+id:''),{method:id?'PATCH':'POST',body});state.fearEdit=null;await savedProgress(result,'Your fear thermometer entry has been saved.');
      });});
    }
    if(state.route==='ladder') {
      $('#expected-fear').addEventListener('input',event=>{$('#expected-fear-output').innerHTML=`${event.target.value}<small>/10</small>`;});
      $('#ladder-form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;submit(form,async()=>{
        const body=Object.fromEntries(new FormData(form));body.expected_fear=Number(body.expected_fear);const id=state.ladderEdit,result=await api('/api/ladder-steps'+(id?'/'+id:''),{method:id?'PATCH':'POST',body});state.ladderEdit=null;await savedProgress(result,'Your ladder step has been saved.');
      });});
      $$('[data-step-status]').forEach(node=>node.addEventListener('click',()=>change(node,()=>api('/api/ladder-steps/'+node.dataset.stepStatus,{method:'PATCH',body:{status:node.dataset.status}}),'Your ladder progress has been saved.')));
      $$('[data-step-move]').forEach(node=>node.addEventListener('click',()=>{
        const order=steps().map(x=>x.id), index=order.indexOf(node.dataset.stepMove), target=index+Number(node.dataset.direction);
        if(target<0||target>=order.length)return;[order[index],order[target]]=[order[target],order[index]];
        change(node,()=>api('/api/ladder-steps/reorder',{method:'POST',body:{ordered_ids:order}}),'Your ladder order has been saved.');
      }));
    }
    if($('#micro-win-form')) {
      $('#micro-win-form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;submit(form,async()=>{
        const id=state.route==='ladder'?null:state.winEdit,result=await api('/api/micro-wins'+(id?'/'+id:''),{method:id?'PATCH':'POST',body:Object.fromEntries(new FormData(form))});state.winEdit=null;await savedProgress(result,'Your micro-win journal entry has been saved.');
      });});
      if(!$('#win-search'))return;
      const search=()=>{
        state.winSearch=$('#win-search').value;
        const cards=$$('#micro-win-history .micro-win-entry');
        cards.forEach(node=>{node.hidden=!node.textContent.toLowerCase().includes(state.winSearch.toLowerCase());});
        if(!$('#win-search-empty'))$('#micro-win-history').insertAdjacentHTML('beforeend','<p id="win-search-empty" class="muted" hidden>No matching wins. Try a different word.</p>');
        $('#win-search-empty').hidden=!cards.length||cards.some(node=>!node.hidden);
      };
      $('#win-search').addEventListener('input',search);search();
    }
  }
  function adminSections(source) {
    return `<section class="card feature-history"><div class="card-heading"><h2>Fear thermometer</h2><span class="pill soft-green">${source.fear_entries?.length||0} entries</span></div>${fearHistory(source.fear_entries||[],true)}</section><section class="card feature-history"><div class="card-heading"><h2>Fear ladder</h2></div>${ladderList(source.ladder_steps||[],true)}</section><section class="card feature-history"><div class="card-heading"><h2>Micro-win journal</h2></div>${microHistory((source.micro_wins||[]).map(x=>({...x,source:'journal'})),true)}</section>`;
  }
  return { pages:{fear:fearPage,ladder:ladderPage,comparison:comparisonPage,'micro-wins':microWinsPage},bind,homeCards,adminSections,recentWins:()=>journalRows().slice(0,3).map(x=>({...x,movement:x.source==='checkin'?x.movement:categories[x.category]})) };
}
