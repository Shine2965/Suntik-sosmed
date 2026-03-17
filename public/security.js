// Anti Inspect
document.addEventListener("contextmenu", e => e.preventDefault());

document.onkeydown = function(e) {
  if (
    e.keyCode == 123 ||
    (e.ctrlKey && e.shiftKey && e.keyCode == 73) ||
    (e.ctrlKey && e.shiftKey && e.keyCode == 74) ||
    (e.ctrlKey && e.keyCode == 85)
  ) {
    reportAttack();
    return false;
  }
};

// Detect DevTools
setInterval(function () {
  const widthThreshold = window.outerWidth - window.innerWidth > 160;
  const heightThreshold = window.outerHeight - window.innerHeight > 160;

  if (widthThreshold || heightThreshold) {
    reportAttack();
  }
}, 1000);

// Detect iframe scraping
if (window.top !== window.self) {
  reportAttack();
}

async function reportAttack(){
  try{
    await fetch("/api/block", {method:"POST"});
    window.location="/blocked";
  }catch{}
}
