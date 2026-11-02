(function () {
  var ready = false;
  var failed = false;
  var timer;
  function status(message) {
    var label = document.getElementById('load-status');
    if (label) label.textContent = message;
  }
  function fail() {
    if (ready || failed) return;
    failed = true;
    clearTimeout(timer);
    var panel = document.getElementById('loading');
    if (!panel) return;
    panel.hidden = false;
    panel.classList.remove('hidden');
    panel.innerHTML = '<span class="loading-mark">技</span><b>这次没能准备好</b><p class="error-note">加载中断或浏览器未能启动游戏。<br>点击下方重新加载，赏钱记录会保留。</p><button class="primary" id="boot-retry" style="width:65%">重新加载</button><small>手机兼容版 v2</small>';
    document.getElementById('boot-retry').onclick = function () {
      if (location.protocol === 'file:') { location.reload(); return; }
      var base = location.href.split('#')[0].split('?')[0];
      location.replace(base + '?v=mobile2&retry=' + Date.now());
    };
  }
  window.WuqiaoBoot = {
    status: status,
    fail: fail,
    ready: function () {
      ready = true;
      clearTimeout(timer);
      var panel = document.getElementById('loading');
      if (panel) { panel.classList.add('hidden'); panel.hidden = true; }
    }
  };
  timer = setTimeout(fail, 35000);
  window.addEventListener('error', fail);
  window.addEventListener('unhandledrejection', fail);
})();
