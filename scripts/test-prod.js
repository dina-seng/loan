async function testProd() {
  console.log('Testing https://loan.dinacreator.space ...\n');

  // 1. Check HTML
  const res = await fetch('https://loan.dinacreator.space');
  console.log('1. Main Page Status:', res.status, res.statusText);
  console.log('   Content-Type:', res.headers.get('content-type'));
  const html = await res.text();
  console.log('   HTML Length:', html.length);
  console.log('   Contains Noto Sans Khmer:', html.includes('Noto Sans Khmer'));
  console.log('   Title:', html.match(/<title>(.*?)<\/title>/)?.[1] || 'No title');
  console.log('   Viewport:', html.match(/<meta name="viewport" content="(.*?)"/)?.[1] || 'No viewport');

  // 2. Extract Script and CSS URLs
  const scriptRegex = /src="(\/assets\/[^"]+)"/g;
  const linkRegex = /href="(\/assets\/[^"]+)"/g;

  let match;
  const jsFiles = [];
  while ((match = scriptRegex.exec(html)) !== null) {
    jsFiles.push(match[1]);
  }

  const cssFiles = [];
  while ((match = linkRegex.exec(html)) !== null) {
    cssFiles.push(match[1]);
  }

  console.log('\n2. Assets referenced:');
  console.log('   JS Files:', jsFiles);
  console.log('   CSS Files:', cssFiles);

  for (const js of jsFiles) {
    const url = 'https://loan.dinacreator.space' + js;
    const jsRes = await fetch(url);
    const content = await jsRes.text();
    console.log(`   -> JS ${js}: HTTP ${jsRes.status}, Size ${content.length} bytes`);
    
    // Check if the script contains Google Apps Script URL
    const hasScriptUrl = content.includes('script.google.com');
    console.log(`      Contains Google Apps Script endpoint reference: ${hasScriptUrl}`);
    if (hasScriptUrl) {
      const matchUrl = content.match(/https:\/\/script\.google\.com\/macros\/s\/[^\/"]+\/exec/);
      console.log(`      Found Endpoint: ${matchUrl ? matchUrl[0] : 'pattern not exact'}`);
    }
  }

  for (const css of cssFiles) {
    const url = 'https://loan.dinacreator.space' + css;
    const cssRes = await fetch(url);
    const content = await cssRes.text();
    console.log(`   -> CSS ${css}: HTTP ${cssRes.status}, Size ${content.length} bytes`);
  }

  // 3. Test Google Apps Script Endpoint directly
  console.log('\n3. Testing Google Apps Script Endpoint Connectivity:');
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzXwu9Kz5J8K4AyzEKYXATtKgiLn68G91XKjEJBybOhH58YMWQ6UtmXPiv0p_XBF8fp2g/exec';

  try {
    const start = Date.now();
    const gasRes = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'list', username: 'probe', password: 'probe-password' }),
      redirect: 'follow',
    });
    const duration = Date.now() - start;
    const gasJson = await gasRes.json();
    console.log(`   Status: HTTP ${gasRes.status} in ${duration}ms`);
    console.log(`   Response JSON:`, gasJson);
    console.log(`   Auth Protection: ${gasJson.error === 'unauthorized' ? 'VERIFIED (Working)' : 'Check config'}`);
  } catch (err) {
    console.error('   Error contacting Apps Script:', err.message);
  }

  // 4. Test Favicon / Vite SVG
  console.log('\n4. Testing Static Assets:');
  try {
    const svgRes = await fetch('https://loan.dinacreator.space/vite.svg');
    console.log(`   vite.svg: HTTP ${svgRes.status}, Content-Type: ${svgRes.headers.get('content-type')}`);
  } catch (e) {
    console.log('   vite.svg error:', e.message);
  }

  console.log('\n=== Production Verification Complete ===');
}

testProd();
