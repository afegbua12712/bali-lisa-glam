import * as React from 'react'
import * as icons from 'lucide-react'
import {read, compile, viewSource} from './order-view-fixtures.mjs'
export {read, compile, viewSource}
export const catalog = [
  {id:1,name:'Rose Lip Oil with a beautifully long product name',category:'Lips',price:18,rating:4.5,reviews:2,image:'/fixture.svg',inventory:6,options:[{id:'shade',name:'Shade',required:true,values:[]}],shades:[],description:'A fixture product.'},
  {id:2,name:'Daily balm',category:'Lips',price:12,rating:0,reviews:0,image:'/fixture.svg',inventory:5,options:[],shades:[]},
  {id:3,name:'Out of stock serum',category:'Skincare',price:32,rating:4,reviews:1,image:'/fixture.svg',inventory:0,options:[],shades:[]},
  {id:4,name:'Soft brush',category:'Beauty',price:20,rating:0,reviews:0,image:'/fixture.svg',inventory:3,options:[],shades:[]},
]
export const favorites = {ids:[1,3,999],signedIn:true,loading:false,error:'',pending:[],errors:{},toggle(){},retry(){}}
export const {FavoriteButton} = compile(read('src/FavoriteButton.tsx'))
const images = compile(read('src/lib/product-images.ts'))
const options = compile(read('src/lib/product-options.ts'))
const journey = compile(read('src/lib/checkout-journey.ts'),{'./product-options':options,'./support-pages':compile(read('src/lib/support-pages.ts'))})
const detailDependencies = {...images,...options,...journey,...compile(read('src/ProductGallery.tsx')),...compile(read('src/ProductOptionSelectors.tsx')),ProductReviews:()=>null}
export const components = compile(`import {FavoriteButton,products,money,Star,Plus} from 'fixture';
  import {useState,useEffect} from 'react';
  import {availableQuantity,productImages,associatedImage,ProductGallery,ProductOptionSelectors,ProductReviews,selectProductOptions,optionSummary,ArrowLeft,Minus,Package} from 'fixture';
  export ${viewSource('Card')}
  export ${viewSource('WishlistView')}
  export ${viewSource('DiscoveryShelf')}
  export ${viewSource('Detail')}`, {fixture:{FavoriteButton,products:catalog,money:n=>'$'+n.toFixed(2),...icons,...detailDependencies}})
export function discoveryFixture(scenario) {
  const props={favorites,show(){},add(){},favoriteSignIn(){},goShop(){},catalogState:'ready'}
  if(scenario==='detail') return React.createElement(components.Detail,{...props,product:catalog[0],bag:[],back(){},signedIn:true,signIn(){}})
  if(scenario==='related'||scenario==='recent') return React.createElement(components.DiscoveryShelf,{...props,title:scenario==='related'?'You may also like':'Recently viewed',items:catalog.filter(p=>p.inventory>0)})
  if(scenario==='prompt') {
    const {FavoriteButton:Prompt}=compile(read('src/FavoriteButton.tsx'),{react:{...React,useState:()=>[true,()=>{}]}})
    return React.createElement('section',{className:'discovery-shelf'},React.createElement('article',{className:'card',style:{width:'240px',height:'280px'}},React.createElement(Prompt,{id:1,name:'Rose',favorites:{...favorites,ids:[],signedIn:false},signIn(){}})))
  }
  const state=scenario==='loading'?{loading:true}:scenario==='error'?{error:'Your favorites could not be loaded. Please try again.'}:scenario==='empty'?{ids:[]}:scenario==='mutation-error'?{errors:{1:'Could not update this favorite. Please try again.'}}:{}
  return React.createElement('section',{className:'account-page'},React.createElement('section',{className:'customer-account customer-portal'},React.createElement('main',null,React.createElement(components.WishlistView,{...props,favorites:{...favorites,...state}}))))
}
