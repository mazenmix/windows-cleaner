'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const JavaScriptObfuscator = require('javascript-obfuscator');
const {minify} = require('html-minifier-terser');
const CleanCSS = require('clean-css');

const PAGES = ['index.html','weather-now.html','news.html','daily-cost-watch.html'];
const marker = 'data-mx-protected="1"';
const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
function protect(code) {
  return JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    numbersToExpressions: false,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: false,
    stringArray: true,
    stringArrayCallsTransform: false,
    stringArrayEncoding: ['base64'],
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.76,
    transformObjectKeys: false,
    unicodeEscapeSequence: false
  }).getObfuscatedCode();
}

async function main() {
  fs.mkdirSync('assets', {recursive:true});
  let generated=0;
  for (const file of PAGES) {
    const original=fs.readFileSync(file,'utf8');
    const scriptRegex=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
    let seenInline=0;
    const result=original.replace(scriptRegex,(whole,attributes,body)=>{
      if(/\bsrc\s*=/i.test(attributes)||!body.trim())return whole;
      if(/\btype\s*=\s*["'](?:application\/(?:ld\+json|json)|importmap)["']/i.test(attributes))return whole;
      if (!/^\s*(?:\(?function\b|\(\s*\(\s*\)|\/\/|\/\*|var\b|let\b|const\b|"use strict"|'use strict')/.test(body)) {
        throw Error('Unknown inline script format in '+file+'; refusing unsafe transformation.');
      }
      const output=protect(body);
      assert.ok(output.length > 150, 'Unexpectedly short protected JS in '+file);
      const name='mx-'+sha(file+'\n'+body)+'.js';
      const destination='assets/'+name;
      fs.writeFileSync(destination,output+'\n');
      const safeAttrs=attributes.replace(/\sdata-mx-protected\s*=\s*["'][^"']*["']/gi,'');
      seenInline++;
      generated++;
      // Keep classic scripts synchronous and in exactly their original DOM positions.
      return '<script'+safeAttrs+' '+marker+' src="/'+destination+'"></script>';
    });
    const processed=await minify(result,{
      collapseWhitespace:true,
      conservativeCollapse:true,
      collapseBooleanAttributes:false,
      decodeEntities:false,
      removeComments:true,
      removeEmptyAttributes:false,
      removeOptionalTags:false,
      removeAttributeQuotes:false,
      removeRedundantAttributes:false,
      minifyCSS:true,
      minifyJS:false,
      sortAttributes:false,
      sortClassName:false,
      caseSensitive:true,
    });
    assert.ok(processed.includes('<html'), 'Minified HTML missing document in '+file);
    if (seenInline)assert.ok(processed.includes(marker),'Protected scripts missing in '+file);
    assert.ok(!/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(processed),
      'Unexpected unprotected inline scripts remain in '+file);
    if (processed !== original)fs.writeFileSync(file,processed+'\n');
    console.log(file, 'protected inline scripts:', seenInline, 'HTML bytes:', original.length,'->',processed.length);
  }
  const jsPath='assets/celebrity-news.js';
  const originalJS=fs.readFileSync(jsPath,'utf8');
  if (!originalJS.startsWith('/* MX-PROTECTED */')) {
    const output=protect(originalJS);
    assert.ok(output.length > 1000, 'Protected celebrity script unexpectedly small');
    fs.writeFileSync(jsPath,'/* MX-PROTECTED */\n'+output+'\n');
    console.log(jsPath,'protected');
  }
  // Secure the independently refreshed PAGASA widget too; Cloudflare Functions stay server-side.
  const typhoonPath='assets/typhoon-live.js';
  const typhoonJS=fs.readFileSync(typhoonPath,'utf8');
  if(!typhoonJS.startsWith('/* MX-PROTECTED */')){
    const protectedTyphoon=protect(typhoonJS);
    assert.ok(protectedTyphoon.length>1000,'Protected typhoon bundle unexpectedly short');
    fs.writeFileSync(typhoonPath,'/* MX-PROTECTED */\n'+protectedTyphoon+'\n');
    console.log(typhoonPath,'protected');
  }
  const typhoonCSSPath='assets/typhoon-live.css';
  const tcCSS=fs.readFileSync(typhoonCSSPath,'utf8');
  const tcMin=new CleanCSS({level:1}).minify(tcCSS);
  if(tcMin.errors.length)throw Error('Typhoon CSS minification failed: '+tcMin.errors.join(' | '));
  if(tcMin.styles.length<tcCSS.length)fs.writeFileSync(typhoonCSSPath,tcMin.styles+'\n');
  // The shared header storm badge runs on all four pages.
  const headerJSPath='assets/global-typhoon-alert.js';
  const headerSource=fs.readFileSync(headerJSPath,'utf8');
  if(!headerSource.startsWith('/* MX-PROTECTED */')){
    const protectedHeader=protect(headerSource);
    assert.ok(protectedHeader.length>1000,'Protected header badge script unexpectedly short');
    fs.writeFileSync(headerJSPath,'/* MX-PROTECTED */\n'+protectedHeader+'\n');
    console.log(headerJSPath,'protected');
  }
  const headerCSSPath='assets/global-typhoon-alert.css';
  const headerCSS=fs.readFileSync(headerCSSPath,'utf8');
  const headerMin=new CleanCSS({level:1}).minify(headerCSS);
  if(headerMin.errors.length)throw Error('Typhoon header CSS minification failed: '+headerMin.errors.join(' | '));
  if(headerMin.styles.length<headerCSS.length)fs.writeFileSync(headerCSSPath,headerMin.styles+'\n');
  // Both RSS refresh and exact badge sizing stay obfuscated after every edit.
  for(const path of ['assets/weather-news-live.js','assets/weather-news-continuous.js','assets/weather-news-multisource.js','assets/home-typhoon-placement.js','assets/daily-typhoon-placement.js','assets/live-refresh-watchdog.js','assets/lpg-source-status.js','assets/lpg-live-sync.js','assets/header-alert-sizing.js']){
    const original=fs.readFileSync(path,'utf8');
    if(!original.startsWith('/* MX-PROTECTED */')){
      const output=protect(original);
      assert.ok(output.length>350,'Protected browser script unexpectedly short: '+path);
      fs.writeFileSync(path,'/* MX-PROTECTED */\n'+output+'\n');
      console.log(path,'protected');
    }
  }
  const homeCSSPath='assets/home-typhoon-placement.css';
  const homeCSS=fs.readFileSync(homeCSSPath,'utf8');
  const homeMin=new CleanCSS({level:1}).minify(homeCSS);
  if(homeMin.errors.length)throw Error('Home cyclone CSS minification failed: '+homeMin.errors.join(' | '));
  if(homeMin.styles.length<homeCSS.length)fs.writeFileSync(homeCSSPath,homeMin.styles+'\\n');
  const dailyCSSPath='assets/daily-typhoon-placement.css';
  const dailyCSS=fs.readFileSync(dailyCSSPath,'utf8');
  const dailyCSSMin=new CleanCSS({level:1}).minify(dailyCSS);
  if(dailyCSSMin.errors.length)throw Error('Daily typhoon CSS minification failed: '+dailyCSSMin.errors.join(' | '));
  if(dailyCSSMin.styles.length<dailyCSS.length)fs.writeFileSync(dailyCSSPath,dailyCSSMin.styles+'\n');
  const lpgCSSPath='assets/lpg-source-status.css';
  const lpgCSS=fs.readFileSync(lpgCSSPath,'utf8');
  const lpgMin=new CleanCSS({level:1}).minify(lpgCSS);
  if(lpgMin.errors.length)throw Error('LPG source CSS minification failed: '+lpgMin.errors.join(' | '));
  if(lpgMin.styles.length<lpgCSS.length)fs.writeFileSync(lpgCSSPath,lpgMin.styles+'\n');
  const cssPath='assets/celebrity-news.css';
  const originalCSS=fs.readFileSync(cssPath,'utf8');
  const cssMin=new CleanCSS({level:1}).minify(originalCSS);
  if(cssMin.errors.length)throw Error('CSS minification failed: '+cssMin.errors.join(' | '));
  if(cssMin.styles.length < originalCSS.length)fs.writeFileSync(cssPath,cssMin.styles+'\n');
  console.log('Completed MX Fuel protection; externalized scripts:',generated);
}
main().catch(e=>{console.error(e);process.exitCode=1;});