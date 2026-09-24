import assert from 'node:assert/strict'

// Synthetic catalog and blocked external requests supplied by the actual-App harness.
export async function runHeaderChecks({call,evaluate,until}) {
  await evaluate('document.querySelector(".product-img").click()')
  await until('!!document.querySelector(".purchase .btn")')
  await evaluate('document.querySelector(".purchase .btn").click()')
  await until('document.querySelector(".cart-count")?.textContent === "1"')
  const escape=()=>call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
  await escape()
  for(const width of [1280,1024,768,390,320])for(const theme of ['light','dark','default']) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]})
    await evaluate(`window.blgAppearance.setPreference('${theme}'); window.scrollTo(0,0)`)
    await until('window.scrollY===0')
    assert.equal(await evaluate('document.documentElement.dataset.theme'),theme==='default'?'dark':theme)
    assert.ok(await evaluate('document.querySelector(".detail").getBoundingClientRect().top >= document.querySelector(".header").getBoundingClientRect().bottom'))
    for(const bottom of [false,true]) {
      await evaluate(`window.scrollTo(0,${bottom?'document.documentElement.scrollHeight':'600'})`)
      await until('window.scrollY>100 && Math.abs(document.querySelector(".header").getBoundingClientRect().top)<1')
      assert.equal(await evaluate(`(()=>{const b=document.querySelector('.cart-count'),r=b.getBoundingClientRect();return b.textContent==='1'&&r.top>=0&&r.bottom<90&&r.right<=innerWidth&&!!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.bag')})()`),true,`${width} ${theme}: visible bag badge`)
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'))
    }
    await evaluate('document.querySelector(".bag").focus();document.querySelector(".bag").click()')
    await until('!!document.querySelector(".drawer.open") && !!document.elementFromPoint(innerWidth-30,30)?.closest(".drawer")')
    assert.equal(await evaluate('document.querySelector(".header").inert'),true)
    await escape()
    await until('!document.querySelector(".drawer.open")')
    assert.equal(await evaluate('document.activeElement.classList.contains("bag")'),true)
    if(await evaluate('document.querySelector(".header .mobile").getClientRects().length>0')) {
      await evaluate('document.querySelector(".header .mobile").focus();document.querySelector(".header .mobile").click()')
      await until('!!document.querySelector(".mobile-menu") && !!document.elementFromPoint(30,30)?.closest(".mobile-menu")')
      assert.equal(await evaluate('!!document.elementFromPoint(30,30)?.closest(".mobile-menu")'),true)
      await escape()
      await until('!document.querySelector(".mobile-menu")')
      assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'),'Open menu')
    }
  }
  console.log('15 actual-App header scenarios passed: synthetic add/badge, mid/end scrolling, content spacing, themes, drawer layering/focus and mobile menu.')
}
