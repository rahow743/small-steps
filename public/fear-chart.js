const DAY = 86400000;
const iso = date => date.toISOString().slice(0, 10);
const formatDate = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function fiveMonthsBefore(today) {
  const [year, month, day] = today.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 6, 1));
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  start.setUTCDate(Math.min(day, lastDay));
  return iso(start);
}

export function rangeStart(today, period) {
  if (period === 'all') return '2000-01-01';
  if (period === '5m') return fiveMonthsBefore(today);
  return iso(new Date(Date.parse(today) - (Number(period) - 1) * DAY));
}

export function fiveMonthWindows(through) {
  const [year,month,day]=through.split('-').map(Number);
  const starts=Array.from({length:6},(_,index)=>{
    const date=new Date(Date.UTC(year,month-6+index,1));
    const lastDay=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
    date.setUTCDate(Math.min(day,lastDay));return iso(date);
  });
  return starts.slice(0,5).map((start,index)=>({start,end:index===4?through:iso(new Date(Date.parse(starts[index+1])-DAY))}));
}

export function fearMonthSummaries(rows,through) {
  return fiveMonthWindows(through).map((period,index)=>{
    const saved=rows.filter(row=>row.date>=period.start&&row.date<=period.end);
    return {...period,month:index+1,days:saved.length,average:saved.length?Math.round(saved.reduce((sum,row)=>sum+row.score,0)/saved.length*10)/10:null};
  });
}

export function buildFearSeries(data, period = '5m') {
  const days = new Map();
  const start = rangeStart(data.today, period);
  for (const row of data.checkins || []) {
    if (row.entry_date >= start && row.entry_date <= data.today) days.set(row.entry_date, { date: row.entry_date, score: row.fear, source: 'Daily check-in' });
  }
  const moments = new Map();
  for (const row of data.fear_entries || []) {
    if (row.entry_date < start || row.entry_date > data.today) continue;
    const values = moments.get(row.entry_date) || [];
    values.push(row.before_score);
    moments.set(row.entry_date, values);
  }
  for (const [date, values] of moments) days.set(date, { date, score: values.reduce((sum, score) => sum + score, 0) / values.length, source: values.length === 1 ? 'Fear thermometer' : `Average of ${values.length} fear thermometer entries` });
  const rows = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  const first = rows.length ? Date.parse(rows[0].date) : 0;
  return rows.map(row => ({ ...row, marker: (Date.parse(row.date) - first) % (14 * DAY) === 0 }));
}

export function fearPointStyle(score) {
  if(score>=7)return {level:'high',color:'#c74b43',label:'High fear'};
  if(score>3)return {level:'moderate',color:'#bf8b32',label:'Moderate fear'};
  return {level:'low',color:'#3f8a62',label:'Low fear'};
}

export function fearProgressChart(data, period, { escape, empty, button, icon }) {
  const rows = buildFearSeries(data, period);
  if (!rows.length) return empty('chart', 'Your fear story starts here.', 'Save a daily check-in or a fear thermometer entry to see your pattern.', button('Notice a feeling', 'fear', 'btn-light', 'plus'));
  const start = Date.parse(rows[0].date), end = Date.parse(rows.at(-1).date);
  const span = Math.round((end - start) / DAY);
  const ticks = Array.from({ length: Math.floor(span / 14) + 1 }, (_, index) => iso(new Date(start + index * 14 * DAY)));
  const width = Math.max(620, ticks.length * 68 + 84), left = 42, right = width - 36, top = 24, bottom = 228;
  const x = date => start === end ? (left + right) / 2 : left + (Date.parse(date) - start) / (end - start) * (right - left);
  const y = score => bottom - score / 10 * (bottom - top);
  const value = score => Number(score.toFixed(1));
  const description = row => `${formatDate(row.date)}: ${fearPointStyle(row.score).label}, ${value(row.score)} out of 10. ${row.source}.`;
  // Break the line across unrecorded days instead of implying recorded values.
  const segments = [];
  for (const row of rows) {
    const segment = segments.at(-1);
    if (!segment || Date.parse(row.date) - Date.parse(segment.at(-1).date) > DAY) segments.push([row]);
    else segment.push(row);
  }
  const first = rows[0], latest = rows.at(-1);
  const monthly=period==='5m'?'<div class="fear-months" aria-label="Monthly average fear">'+fearMonthSummaries(rows,data.today).map(month=>'<div><span>Month '+month.month+'</span><strong>'+(month.average===null?'—':month.average)+'<small>/10</small></strong><span>'+formatDate(month.start)+' – '+formatDate(month.end)+'</span></div>').join('')+'</div><p class="fear-chart-source">Monthly averages use recorded days. Missing days are not counted as zero.</p>':'';
  return `<div class="fear-chart-summary"><div><span>First recorded</span><strong>${value(first.score)}<small>/10</small></strong><span>${formatDate(first.date)}</span></div><span class="fear-summary-arrow" aria-hidden="true">${icon('arrow')}</span><div><span>Latest recorded</span><strong>${value(latest.score)}<small>/10</small></strong><span>${formatDate(latest.date)}</span></div></div>${monthly}<div class="chart-legend"><span><i class="legend-dot fear-high-dot"></i>High fear</span><span><i class="legend-dot fear-moderate-dot"></i>Moderate fear</span><span><i class="legend-dot fear-low-dot"></i>Low fear</span><span><i class="fear-marker-key"></i>Every 2 weeks</span><span class="chart-scale">0 = no fear · 10 = very intense</span></div><p class="fear-chart-source">Daily fear thermometer ratings, averaged when there is more than one. Uses the daily check-in on days without a thermometer entry.</p><div class="chart-wrap fear-chart-scroll" tabindex="0" role="region" aria-label="Fear level line graph. Scroll horizontally to see all dates."><svg class="progress-chart fear-progress-chart" width="${width}" height="278" viewBox="0 0 ${width} 278" role="img" aria-label="Fear levels from ${formatDate(first.date)} to ${formatDate(latest.date)}. ${rows.length} recorded days. Date markers every two weeks. Missing days have gaps; the daily values are available below.">${[0,2,4,6,8,10].map(score => `<line x1="${left}" y1="${y(score)}" x2="${right}" y2="${y(score)}" stroke="#e7ebe5" stroke-dasharray="3 5"/><text x="19" y="${y(score)+4}" fill="#687460" font-size="12">${score}</text>`).join('')}${ticks.map(date => `<line x1="${x(date)}" y1="${top}" x2="${x(date)}" y2="${bottom}" stroke="#edf0e8"/><text x="${x(date)}" y="255" text-anchor="middle" fill="#687460" font-size="12">${escape(formatDate(date))}</text>`).join('')}${segments.map(segment => `<polyline points="${segment.map(row => `${x(row.date)},${y(row.score)}`).join(' ')}" fill="none" stroke="#93a298" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}${rows.map(row => `<circle class="fear-daily-point" cx="${x(row.date)}" cy="${y(row.score)}" data-fear-level="${fearPointStyle(row.score).level}" r="${row.marker ? 5.5 : 3}" fill="${fearPointStyle(row.score).color}" stroke="${row.marker ? '#fff' : 'none'}" stroke-width="2" ${row.marker ? `tabindex="0" role="img" aria-label="${escape(description(row))}"` : ''}><title>${escape(description(row))}</title></circle>`).join('')}</svg></div><div class="chart-footnote">${icon('heart')} Higher-fear days belong in your story too. A difficult day does not erase your progress.</div><p class="fear-scroll-hint">Scroll across the graph for all dates. Markers are spaced 14 days apart.</p><details class="fear-chart-values"><summary>View daily fear ratings</summary><div class="table-scroll"><table><thead><tr><th>Date</th><th>Fear / 10</th><th>Source</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escape(row.date)}</td><td>${value(row.score)}</td><td>${escape(row.source)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
