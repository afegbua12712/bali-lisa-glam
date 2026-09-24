import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync,existsSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {createRequire} from 'node:module'
import * as React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'
const require=createRequire(import.meta.url)
const appPath=resolve('src/App.tsx')
const source=readFileSync(appPath,'utf8')
const ast=ts.createSourceFile(appPath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const app=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='App')
const stateNames=[]
for(const statement of app.body.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations) {
  if(ts.isArrayBindingPattern(declaration.name)&&ts.isCallExpression(declaration.initializer)&&declaration.initializer.expression.getText(ast)==='useState')stateNames.push(declaration.name.elements[0].name.text)
}
const product=(id,category='Lips',inventory=5)=>({id,name:`Product ${id}`,category,inventory,price:12,rating:0,reviews:0,image:'/fixture.svg',images:[],description:'Fixture',shades:[],options:[]})
const catalog=[product(1),product(2),product(3,'Lips',0),product(4,'Eyes'),product(5,'Skin'),product(6,'Lips'),product(7,'Beauty')]

// Render the complete real App and its real descendants, including Footer.
// Only root state and the already-loaded catalog are seeded; no JSX branch,
// selector, Detail, DiscoveryShelf or Card is replaced/extracted into a fixture.
function renderApp(rows=catalog,recent=[4,2],catalogState='ready') {
  const cache=new Map();let stateIndex=0
  const seeded={page:'product',active:rows[0]??product(1),cart:[],recent,catalogState,authReady:true}
  function load(file) {
    if(cache.has(file))return cache.get(file)
    if(file.endsWith('/supabase.ts')||file.endsWith('\\supabase.ts'))return {supabase:new Proxy({}, {get(){throw Error('No database access during render')}})}
    let code=readFileSync(file,'utf8').replaceAll('import.meta.env','({})')
    if(file===appPath){assert.ok(code.includes('const products: Product[] = [];'));code=code.replace('const products: Product[] = [];','const products: Product[] = __catalog;')}
    const exports={};cache.set(file,exports)
    const resolveImport=name=>{
      if(name.endsWith('.css'))return {}
      if(name==='react'&&file===appPath)return {...React,useState:initial=>{const key=stateNames[stateIndex++];return React.useState(Object.hasOwn(seeded,key)?seeded[key]:initial)}}
      if(!name.startsWith('.'))return require(name)
      const path=resolve(dirname(file),name),target=[path,path+'.ts',path+'.tsx'].find(existsSync)
      assert.ok(target,`Missing ${name}`);return load(target)
    }
    new Function('exports','require','__catalog',ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(exports,resolveImport,rows)
    return exports
  }
  const previous=globalThis.window;globalThis.window={location:{hash:''}}
  try{return renderToStaticMarkup(React.createElement(load(appPath).default))}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous}
}
const shelf=(html,title)=>html.match(new RegExp(`<section class="discovery-shelf" aria-label="${title}">([\\s\\S]*?)</section>`))?.[1]
test('real active App product route renders ranked related cards after reviews and before footer',()=>{
  const html=renderApp(),related=shelf(html,'You may also like')
  assert.ok(related,'App must mount the actual discovery shelf')
  const names=[...related.matchAll(/<button>Product (\d+)<\/button>/g)].map(match=>Number(match[1]))
  assert.deepEqual(names,[2,6,4,5])
  assert.ok(!related.includes('Product 1'));assert.ok(!related.includes('Product 3'))
  assert.ok(html.indexOf('Shipping &amp; returns')<html.indexOf('You may also like'))
  assert.ok(html.indexOf('Customer reviews')<html.indexOf('You may also like'))
  assert.ok(html.indexOf('You may also like')<html.indexOf('<footer'))
})
test('real App uses other-category fallback, hides zero eligible results, and gates an unresolved catalog',()=>{
  const fallback=shelf(renderApp([product(1),product(4,'Eyes')]),'You may also like')
  assert.ok(fallback?.includes('Product 4'))
  assert.equal(shelf(renderApp([product(1),product(2,'Lips',0)],[]),'You may also like'),undefined)
  assert.equal(shelf(renderApp(catalog,[],'loading'),'You may also like'),undefined)
  assert.ok(shelf(renderApp(catalog,[],'ready'),'You may also like'))
})
test('real App mounts Recently viewed with valid history, excluding current/missing/out-of-stock products',()=>{
  const html=renderApp(catalog,[1,999,3,4,2,4]),recent=shelf(html,'Recently viewed')
  assert.ok(recent)
  assert.deepEqual([...recent.matchAll(/<button>Product (\d+)<\/button>/g)].map(match=>Number(match[1])),[4,2])
  assert.ok(html.indexOf('You may also like')<html.indexOf('Recently viewed'))
  assert.ok(html.indexOf('Recently viewed')<html.indexOf('<footer'))
  assert.equal(shelf(renderApp(catalog,[]),'Recently viewed'),undefined)
})
