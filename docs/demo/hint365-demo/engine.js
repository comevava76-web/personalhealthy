  /* --- scripted demo: HINT 365, the sign-in on the phone and the real Web Dashboard screens (test data only) --- */
  (function(){
    var root = document.getElementById("hp-root");
    if(!root) return;
    var $ = function(id){ return document.getElementById(id); };
    var stage = $("hp-stage"), cursor = $("hp-cursor"), cap = $("hp-cap"), prog = $("hp-progress"), url = $("hp-url");
    var phone = $("hp-phone"), part = $("hp-part");
    var shots = Array.prototype.slice.call(stage.querySelectorAll(".hp-shot"));
    var F = {"f1-bp":{"share":{"x":237,"y":32},"pdf":{"x":363,"y":32}},"f2-charts":{"chart":{"x":500,"y":417}},"f3-hover":{"point":{"x":610,"y":383}},"f4-share":{},"f5-labs":{},"u1-admin":{"tiles":{"x":500,"y":192},"obs":{"x":146,"y":365}},"u2-versions":{},"u3-observability":{"vulns":{"x":821,"y":240},"compliance":{"x":500,"y":240}},"u4-vulns":{},"u5-compliance":{}};
    var timers = [], raf = null, playing = false, DURATION = 30000;
    function at(ms, fn){ timers.push(setTimeout(fn, ms)); }
    function clearAll(){ timers.forEach(clearTimeout); timers = []; if(raf) cancelAnimationFrame(raf); }
    function shot(n){ shots.forEach(function(s){ s.classList.toggle("live", s.getAttribute("data-shot") === n); }); phone.classList.toggle("away", !!n); }
    function say(t){ cap.textContent = t; }
    function xy(p){ var r = stage.getBoundingClientRect(); return { x: p.x / 1000 * r.width, y: p.y / 560 * r.height }; }
    function moveXY(p){ var q = xy(p); cursor.style.transform = "translate(" + q.x + "px," + q.y + "px)"; }
    function moveEl(el){ var a = el.getBoundingClientRect(), b = stage.getBoundingClientRect(); cursor.style.transform = "translate(" + (a.left - b.left + a.width / 2) + "px," + (a.top - b.top + a.height / 2) + "px)"; }
    function ripple(x, y, finger){
      var t = document.createElement("span"); t.className = "tap" + (finger ? " finger" : "");
      t.style.left = x + "px"; t.style.top = y + "px"; stage.appendChild(t); setTimeout(function(){ t.remove(); }, 800);
    }
    function click(){ var m = cursor.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/); if(m) ripple(+m[1], +m[2]); }
    function tapEl(el){ var a = el.getBoundingClientRect(), b = stage.getBoundingClientRect(); ripple(a.left - b.left + a.width / 2, a.top - b.top + a.height / 2, true); }
    function toast(t){ var e = $("hp-toast"); e.textContent = t; e.classList.add("on"); at(1700, function(){ e.classList.remove("on"); }); }
    function reset(){
      clearAll(); shot(null); part.textContent = "1 · What you do"; url.textContent = "HINT 365 · Android app";
      cursor.classList.add("hide"); cursor.style.transform = "translate(80px,300px)";
      prog.style.width = "0%"; root.classList.remove("playing");
    }
    function run(){
      if(playing) return;
      reset(); playing = true; root.classList.add("playing");
      var t0 = Date.now();
      (function tick(){ var p = Math.min(1, (Date.now() - t0) / DURATION); prog.style.width = (p * 100) + "%"; if(p < 1) raf = requestAnimationFrame(tick); })();
      say("Sign in with your Google account: the same diary on any new phone");
      at(900,  function(){ tapEl($("hp-google")); });
      at(1700, function(){ shot("f1-bp"); url.textContent = "hint365 · Web Dashboard"; cursor.classList.remove("hide"); moveXY({x:500,y:120}); say("Your Web Dashboard: one average a day, seven days, SYS and DIA"); });
      at(2600, function(){ moveXY({x:236,y:337}); });
      at(3500, function(){ moveXY({x:486,y:300}); });
      at(4400, function(){ shot("f3-hover"); moveXY(F["f3-hover"].point); say("Point at a day: its average and how many readings"); });
      at(6400, function(){ shot("f1-bp"); moveXY(F["f1-bp"].pdf); say("The report as a PDF, ready for the doctor"); });
      at(7200, function(){ click(); toast("Download complete · blood pressure report (PDF)"); });
      at(8700, function(){ moveXY(F["f1-bp"].share); say("Or send it straight to the doctor"); });
      at(9400, function(){ click(); });
      at(9700, function(){ shot("f4-share"); say("Email or WhatsApp: the PDF and a read-only link, valid 7 days"); });
      at(10600,function(){ moveXY({x:378,y:278}); });
      at(12000,function(){ shot("f5-labs"); moveXY({x:220,y:100}); say("Lab results: every report you upload, in one table, one column per date"); });
      at(13200,function(){ moveXY({x:408,y:297}); say("In orange only what is outside the range printed on the report. No diagnosis."); });
      at(15600,function(){ shot("u1-admin"); part.textContent = "2 · Behind the scenes"; url.textContent = "hint365 · Owner's console"; moveXY(F["u1-admin"].tiles); say("Behind the scenes: open weaknesses, defects, compliance, at a glance"); });
      at(18200,function(){ shot("u2-versions"); moveXY({x:150,y:368}); say("Who uses which app version: only the newest one works"); });
      at(20400,function(){ moveXY({x:146,y:125}); say("Observability: problems, compliance, vulnerabilities"); });
      at(21000,function(){ click(); });
      at(21300,function(){ shot("u3-observability"); url.textContent = "hint365 · Observability"; });
      at(22200,function(){ moveXY(F["u3-observability"].vulns); });
      at(22800,function(){ click(); });
      at(23100,function(){ shot("u4-vulns"); moveXY({x:860,y:340}); say("Scanned every Monday night: each weakness gets a fix date or a written reason"); });
      at(24800,function(){ moveXY({x:860,y:409}); });
      at(26300,function(){ shot("u5-compliance"); url.textContent = "hint365 · Compliance"; moveXY({x:500,y:240}); say("EU and Swiss data rules, checked control by control"); });
      at(DURATION, function(){
        playing = false; root.classList.remove("playing"); cursor.classList.add("hide");
        say("Thirty seconds: sign in, the week in charts, the PDF, the doctor, lab results, and the checks behind the scenes. Test data only.");
      });
    }
    $("hp-replay").addEventListener("click", function(){ playing = false; run(); });
    reset();
    new IntersectionObserver(function(e){ e.forEach(function(x){ if(x.isIntersecting) run(); }); }, {threshold:.35}).observe(root);
  })();
