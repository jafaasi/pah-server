const { WinGoEngine } = require('./src/app/api/predict/engine_v2.ts');

async function test() {
  const ts = Date.now();
  const res = await fetch(`https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?ts=${ts}`, {
    headers: {
      'origin': 'https://www.bdgwin888.com',
      'referer': 'https://www.bdgwin888.com/',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  const data = await res.json();
  const history = data.data.list.map(h => parseInt(h.number));
  console.log('History:', history.slice(0, 15));
  const masterState = WinGoEngine.backtrackMasterState(history);
  console.log('Master State:', masterState);
}
test();
