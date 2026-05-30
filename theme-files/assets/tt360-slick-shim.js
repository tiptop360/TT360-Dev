(function($){
if(!$||!$.fn)return;
var swiperReady=typeof Swiper!=='undefined';
var pending=[];
function waitForSwiper(fn){if(typeof Swiper!=='undefined'){fn()}else{pending.push(fn);if(pending.length===1){var iv=setInterval(function(){if(typeof Swiper!=='undefined'){clearInterval(iv);var q=pending.slice();pending=[];q.forEach(function(f){f()})}},50)}}}
function mapBreakpoints(responsive,base){
if(!responsive||!responsive.length)return{};
var bp={};
var sorted=responsive.slice().sort(function(a,b){return a.breakpoint-b.breakpoint});
for(var i=0;i<sorted.length;i++){
var r=sorted[i];
if(r.settings==='unslick'){bp[r.breakpoint]={enabled:false};continue}
var s=r.settings||{};
bp[r.breakpoint > 0 ? r.breakpoint : 0]={
slidesPerView:s.slidesToShow||base.slidesPerView||1,
slidesPerGroup:s.slidesToScroll||s.slidesToShow||1,
grid:s.rows&&s.rows>1?{rows:s.rows,fill:'row'}:undefined
}}
return bp}
function buildSwiperOpts(o){
var cfg={
slidesPerView:o.slidesToShow||1,
slidesPerGroup:o.slidesToScroll||1,
loop:o.infinite!==false,
speed:o.speed||300,
allowTouchMove:o.draggable!==false,
autoHeight:!!o.adaptiveHeight,
watchOverflow:true,
observer:true,
observeParents:true
};
if(o.rtl)cfg.rtl=true;
if(o.fade)cfg.effect='fade';
if(o.vertical){cfg.direction='vertical'}
if(o.autoplay&&o.autoplay!==false){
cfg.autoplay={delay:o.autoplaySpeed||5000,disableOnInteraction:o.pauseOnHover!==false};
if(o.pauseOnFocus===false&&o.pauseOnHover===false){cfg.autoplay.disableOnInteraction=false;cfg.autoplay.pauseOnMouseEnter=false}}
if(o.arrows){cfg.navigation={nextEl:'.swiper-button-next',prevEl:'.swiper-button-prev'}}
if(o.dots){cfg.pagination={el:'.swiper-pagination',clickable:true,type:'bullets'}}
if(o.rows&&o.rows>1){cfg.grid={rows:o.rows,fill:'row'}}
if(o.centerMode){cfg.centeredSlides=true;if(o.centerPadding)cfg.slidesOffsetBefore=parseInt(o.centerPadding)||0}
if(o.responsive){cfg.breakpoints=mapBreakpoints(o.responsive,cfg)}
return cfg}
function wrapMarkup($el,opts){
var $slides=$el.children();
if(!$el.find('.swiper-wrapper').length){
$slides.addClass('swiper-slide');
$slides.wrapAll('<div class="swiper-wrapper"></div>')}
if(opts.arrows&&!$el.find('.swiper-button-next').length){
$el.append('<div class="swiper-button-next"></div><div class="swiper-button-prev"></div>')}
if(opts.dots&&!$el.find('.swiper-pagination').length){
$el.append('<div class="swiper-pagination"></div>')}
$el.addClass('swiper')}
$.fn.slick=function(){
var args=Array.prototype.slice.call(arguments);
var method=typeof args[0]==='string'?args[0]:null;
var opts=typeof args[0]==='object'?args[0]:{};
return this.each(function(){
var $el=$(this);
var sw=$el.data('_swiper');
if(method){
if(!sw)return;
switch(method){
case'slickGoTo':
var idx=args[1]||0;
if(sw.params.loop){sw.slideToLoop(idx,args[2]?0:300)}else{sw.slideTo(idx,args[2]?0:300)}
break;
case'slickPause':if(sw.autoplay)sw.autoplay.stop();break;
case'slickPlay':if(sw.autoplay)sw.autoplay.start();break;
case'slickCurrentSlide':return sw.realIndex||0;
case'unslick':case'destroy':sw.destroy(true,true);$el.removeData('_swiper');break;
case'resize':case'refresh':sw.update();break;
case'slickAdd':break;
case'slickRemove':break;
case'slickFilter':break;
case'slickUnfilter':break;
case'getSlick':return{$slides:$el.find('.swiper-slide'),slideCount:sw.slides?sw.slides.length:0,currentSlide:sw.realIndex||0};
default:break}
return}
waitForSwiper(function(){
var swiperCfg=buildSwiperOpts(opts);
wrapMarkup($el,opts);
swiperCfg.on={
init:function(s){
var obj={$list:$el,$slides:$el.find('.swiper-slide'),slideCount:s.slides?s.slides.length:0,currentSlide:s.realIndex||0};
$el.trigger('init',[obj])},
slideChangeTransitionStart:function(s){
$el.trigger('beforeChange',[{currentSlide:s.previousIndex},s.previousIndex,s.realIndex])},
slideChangeTransitionEnd:function(s){
$el.trigger('afterChange',[s,s.realIndex])}};
if(opts.asNavFor){
var $nav=$(opts.asNavFor);
var navSw=$nav.data('_swiper');
if(navSw){swiperCfg.thumbs={swiper:navSw}}else{
$nav.one('swiperReady',function(){
var n=$nav.data('_swiper');
if(n&&sw){sw.thumbs.swiper=n;sw.thumbs.init();sw.thumbs.update(true)}})}}
try{
var sw=new Swiper($el[0],swiperCfg);
$el.data('_swiper',sw);
$el.trigger('swiperReady');
$el.css('opacity','1')}catch(e){console.warn('Slick shim init error:',e)}})})};
$.fn.slick.defaults={};
})(window.jQuery);
