
(function(global){
  'use strict';

  // ---------- Configuration ----------
  var REDIRECT_HOME = '/home/';
  var REDIRECT_AFTER_TAMPER = '/home/';
  var JSON_PATH = '/bugwas/9AaYq5TS.json';
  var WATERMARK_B64 = 'U2hpbmUgU2hvcA=='; // Shine Shop
  var CHECK_INTERVAL = 800; // ms
  var DEVTOOLS_TIME_THRESHOLD = 120; // ms

  // ---------- Helpers ----------
  function b64(s){ try{ return atob(s); }catch(e){return ''; } }
  function now(){ return (new Date()).getTime(); }
  function noop(){}

  // safe text setter
  function setMsg(text){
    try{ var el = document.getElementById('msg'); if(el) el.textContent = text; }catch(e){}
  }

  // safe redirect
  function redirect(h){
    try{ window.location.href = h; }catch(e){}
  }

  // ---------- String obfuscation helpers ----------
  // XOR-decode function for encoded strings (simple)
  function xorDecode(b64str, key){
    try{
      var raw = atob(b64str);
      var out = '';
      for(var i=0;i<raw.length;i++){
        out += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return out;
    }catch(e){ return ''; }
  }

  // ---------- Anti-UI (disable right-click, keys) ----------
  function blockKeysAndMenu(){
    try{
      document.addEventListener('contextmenu', function(e){ e.preventDefault(); e.stopPropagation(); }, true);
      document.addEventListener('copy', function(e){ e.preventDefault(); }, true);
      document.addEventListener('cut', function(e){ e.preventDefault(); }, true);
      document.addEventListener('paste', function(e){ e.preventDefault(); }, true);
      document.addEventListener('keydown', function(e){
        // Block F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S
        if(e.keyCode === 123) { e.preventDefault(); e.stopPropagation(); return false; }
        if(e.ctrlKey && e.shiftKey && (e.keyCode===73||e.keyCode===74||e.keyCode
