/* GLSL cho visual sàn. Tất cả animation đều LOOP-SAFE:
 * uT chạy 0→1 đúng 1 chu kỳ, mọi hàm theo uT đều có tần số NGUYÊN
 * (sin/cos(TAU*k*uT), fract(x - k*uT), drift theo vòng tròn) → nối đầu-cuối không thấy mối.
 */
(function (global) {
  'use strict';

  const VS_QUAD = `#version 300 es
precision highp float;
out vec2 vUv;
void main(){
  vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2);
  vUv = p; gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}`;

  const COMMON = `
#define TAU 6.28318530718
uniform vec2  uRes;
uniform float uT;
uniform float uScale;      // px trên mét
uniform vec2  uN[5];       // pháp tuyến ngoài của 5 cạnh
uniform float uD[5];       // dot(đỉnh, pháp tuyến)

float sdPoly(vec2 p){
  float d = -1e9;
  for(int i=0;i<5;i++) d = max(d, dot(p, uN[i]) - uD[i]);
  return d;                // <0 trong phòng, đơn vị mét
}
float hash31(vec3 p){
  p = fract(p*0.3183099 + vec3(0.11,0.17,0.13));
  p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}
float noise3(vec3 x){
  vec3 i = floor(x), f = fract(x);
  f = f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(mix(hash31(i+vec3(0,0,0)),hash31(i+vec3(1,0,0)),f.x),
                 mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),
                 mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p, int oct){
  float a=0.5, s=0.0;
  for(int i=0;i<6;i++){ if(i>=oct) break; s += a*noise3(p); p = p*2.03 + 19.7; a *= 0.5; }
  return s;
}
float ridge(vec3 p, int oct){ float v = fbm(p,oct); return pow(1.0-abs(v*2.0-1.0), 2.2); }
// xung tuần hoàn dọc theo tham số ph (bề rộng w)
float bump(float ph, float w){ float f = fract(ph); float d = min(f, 1.0-f); return exp(-(d*d)/(2.0*w*w)); }
`;

  /* ---------------- SCENE ---------------- */
  const FS_SCENE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
` + COMMON + `
uniform sampler2D uRoot;
uniform float uPoolR;
uniform float uEmit;
uniform vec2  uDoor[9];      // chân 9 cửa (mét)
uniform float uDoorPh[9];    // pha nhịp thở riêng từng cửa

/* cao độ nền đất (dùng để dựng pháp tuyến giả -> nổi khối) */
float terr(vec2 p){
  return 0.62*fbm(vec3(p*1.15, 3.0), 4) + 0.38*fbm(vec3(p*4.60, 11.0), 3);
}

/* lá rụng rải trên đất: mỗi ô 34 cm gieo 1 chiếc lá xoay ngẫu nhiên */
float litter(vec2 p, out float seedOut){
  float cov = 0.0; seedOut = 0.0;
  vec2 ip = floor(p/0.19);
  for(int j=-1;j<=1;j++){
    for(int i=-1;i<=1;i++){
      vec2 cc = ip + vec2(float(i), float(j));
      float h1 = hash31(vec3(cc, 1.0)), h2 = hash31(vec3(cc, 2.0));
      float h3 = hash31(vec3(cc, 3.0)), h4 = hash31(vec3(cc, 4.0));
      if(h4 < 0.34) continue;
      vec2 ctr = (cc + vec2(h1, h2))*0.19;
      float a = h3*3.14159, ca = cos(a), sa = sin(a);
      vec2 d = p - ctr;
      d = vec2(d.x*ca - d.y*sa, d.x*sa + d.y*ca);
      d /= vec2(0.052 + 0.030*h4, 0.021 + 0.014*h1);
      float k = smoothstep(0.0, 0.42, 1.0 - dot(d,d));
      if(k > cov){ cov = k; seedOut = h3; }
    }
  }
  return cov;
}

/* cao độ tổng: đất + rễ (mét) */
float rootH(vec2 uv){
  vec4 t = texture(uRoot, uv);
  return t.r*0.115 + t.b*0.012;                  // R = vòm cao độ đã bake sẵn
}
float heightAt(vec2 mp, vec2 uv){
  return terr(mp)*0.048 + rootH(uv);
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 m  = (fc - uRes*0.5) / uScale;              // mét, y hướng lên
  vec2 ruv = vec2(fc.x, uRes.y - fc.y) / uRes;     // texture rễ ở hệ ảnh (y xuống)

  float sd  = sdPoly(m);
  float din = -sd;
  float r   = length(m);
  float pr  = r/uPoolR;

  /* ---- PHÁP TUYẾN từ cao độ (đất + rễ chung 1 mặt) ---- */
  float dM = 2.5/uScale;                 // bước lấy mẫu ~2.5 px
  vec2  dU = vec2(2.5,2.5)/uRes;
  float hR = heightAt(m + vec2(dM,0.0), ruv + vec2(dU.x, 0.0));
  float hL = heightAt(m - vec2(dM,0.0), ruv - vec2(dU.x, 0.0));
  float hU = heightAt(m + vec2(0.0,dM), ruv - vec2(0.0, dU.y));
  float hD = heightAt(m - vec2(0.0,dM), ruv + vec2(0.0, dU.y));
  vec3  N  = normalize(vec3(-(hR-hL)/(2.0*dM), -(hU-hD)/(2.0*dM), 1.0));

  /* ---- ÁNH SÁNG: trăng lạnh chiếu đều + hồ hắt cyan ở gần ---- */
  vec3  Lmoon = normalize(vec3(0.40, 0.58, 0.70));
  float dm    = max(dot(N, Lmoon), 0.0);
  vec3  Lpool = normalize(vec3(-m, 0.95));
  float dp    = max(dot(N, Lpool), 0.0);
  float fall  = 1.0/(1.0 + r*r*0.20);
  vec3  Hv    = normalize(Lpool + vec3(0.0,0.0,1.0));
  float spec  = pow(max(dot(N, Hv), 0.0), 30.0);

  /* ---- ALBEDO nền ---- */
  vec2 w1 = m + 0.45*vec2(fbm(vec3(m*0.55, 1.70), 4), fbm(vec3(m*0.55, 8.30), 4));
  float soil = fbm(vec3(w1*1.30, 3.10), 5);
  float grit = fbm(vec3(m*22.0, 31.0), 2);
  float pat  = smoothstep(0.36, 0.74, fbm(vec3(m*0.42, 21.0), 3));

  vec3 alb = mix(vec3(0.082,0.105,0.117), vec3(0.172,0.322,0.225), smoothstep(0.34,0.76,soil));
  alb = mix(alb, vec3(0.300,0.212,0.135), pat*0.72);
  alb *= 0.86 + 0.28*grit;
  float hollow = fbm(vec3(m*0.62, 41.0), 3);
  alb *= mix(0.52, 1.30, smoothstep(0.28, 0.78, hollow));      // hõm tối / gò sáng

  float ls; float leaf = litter(m, ls);
  vec3 leafC = mix(vec3(0.330,0.202,0.101), vec3(0.243,0.277,0.142), ls);
  alb = mix(alb, leafC, leaf*(0.42 + 0.45*smoothstep(3.6, 1.4, din*0.0 + r)));   // lá dồn về phía tường

  vec4  R    = texture(uRoot, ruv);
  float body = smoothstep(0.012, 0.075, R.r); float arc = R.g, halo = R.b, vein = R.a;
  float bark = 0.55 + 0.85*fbm(vec3(m*46.0, 7.0), 3);
  vec3  barkA = vec3(0.355, 0.212, 0.138) * bark;
  alb = mix(alb, barkA, clamp(body*1.45, 0.0, 1.0));

  float shine = mix(0.25, 1.0, leaf) * (0.4 + 0.6*smoothstep(0.4,0.8,soil));

  /* ---- 9 VÙNG SÁNG ẤM HẮT RA TỪ CHÂN CỬA ---- */
  vec3 doorLit = vec3(0.0);
  float doorGlow = 0.0;
  for(int i=0;i<9;i++){
    vec2  dv = uDoor[i] - m;
    float dd = length(dv);
    float att = exp(-dd*0.95) * (0.62 + 0.38*sin(TAU*(uT + uDoorPh[i])));
    vec3  Ld = normalize(vec3(dv, 0.55));
    doorLit += vec3(1.00, 0.62, 0.28) * max(dot(N, Ld), 0.0) * att;
    doorGlow += att;
  }

  /* ---- ĐỔ BÓNG / TÔ MÀU ---- */
  vec3 moonC = vec3(0.300, 0.400, 0.600);
  vec3 poolC = vec3(0.330, 0.640, 0.590);
  vec3 ambC  = vec3(0.055, 0.078, 0.105)*(0.40 + 0.60*N.z);
  vec3 col = alb * (moonC*(0.30 + 1.00*dm) + poolC*(dp*fall*1.55) + doorLit*2.10
                    + ambC*(0.55 + 0.45*smoothstep(0.0,1.6,din)));
  col += vec3(0.30, 0.15, 0.055) * doorGlow * 0.085;          // hơi sáng lan trên mặt đất
  col += poolC * spec * shine * fall * 0.16;
  col *= mix(0.78, 1.0, smoothstep(0.0, 1.20, din));

  /* ---- RÊU PHÁT QUANG ---- */
  float sp = fbm(vec3(m*19.0, 5.0), 2);
  float lich = smoothstep(0.735, 0.870, sp) * smoothstep(0.05, 0.75, din) * (1.0 - body)
               * (0.55 + 0.85*smoothstep(3.2, 1.1, r));
  col += vec3(0.030,0.105,0.085) * lich * (0.45 + 0.55*sin(TAU*(2.0*uT + sp*9.0)));

  /* ---- MẠCH SÁNG TRONG RỄ ---- */
  float drops = bump(arc*2.0 - uT*4.0, 0.070) + 0.7*bump(arc*2.0 - uT*4.0 + 0.5, 0.050);
  float surge = bump(arc*1.0 - uT*1.0 - 0.15, 0.24);
  float pulse = drops*0.85 + surge*0.75;
  vec3 cWarm = vec3(1.000, 0.560, 0.190);
  vec3 cMint = vec3(0.480, 0.980, 0.760);
  vec3 rc = mix(cWarm, cMint, smoothstep(0.86, 1.00, arc));
  float breath = 0.014 + 0.010*sin(TAU*(uT + arc*1.35));
  float emit = vein*(breath + 3.20*pulse) + halo*body*(breath*0.25 + 0.42*pulse);
  col += rc * emit * uEmit;

  /* ---- HỒ SÁNG ---- */
  float wob = 1.0 + 0.09*fbm(vec3(normalize(m + 1e-5)*2.2, 6.0), 3) - 0.045;
  float prw = pr/wob;
  float swirl = TAU*uT + 0.85/(0.45 + r);
  float cs = cos(swirl), sn = sin(swirl);
  vec2  pm = mat2(cs, -sn, sn, cs) * m;
  float cau  = ridge(vec3(pm*2.10, 4.0), 4);
  float cau2 = ridge(vec3(pm*4.60 + 3.0, 9.0), 3);
  float liquid = smoothstep(1.02, 0.86, prw);
  float ring   = smoothstep(1.01, 0.965, prw) - smoothstep(0.965, 0.90, prw);

  float web = pow(cau, 2.2)*0.75 + pow(cau2, 3.0)*0.45;
  col = mix(col, vec3(0.006, 0.022, 0.030), liquid*0.96);       // mặt nước tối
  col += vec3(0.180, 0.880, 0.820) * liquid * (0.05 + 1.15*web)
         * (0.86 + 0.14*sin(TAU*(2.0*uT)));                      // mạng caustic
  col += vec3(0.640, 1.000, 0.950) * max(ring, 0.0) * 0.62;      // viền hồ mảnh & sáng
  col += vec3(0.300, 0.940, 0.880) * liquid * pow(max(0.0, 1.0 - prw*1.20), 4.0) * 0.10;

  /* ---- GỢN LAN RA ---- */
  float rr = max(0.0, r - uPoolR);
  float rip = pow(max(0.0, sin(TAU*(rr*0.72 - uT*3.0))), 6.0);
  col += vec3(0.22,0.80,0.76) * rip * exp(-rr*0.38) * 0.115;

  /* ---- SƯƠNG TRÔI ---- */
  vec2 dr = 0.42*vec2(cos(TAU*uT), sin(TAU*uT));
  float mist = 0.62*fbm(vec3((m+dr)*0.60, 2.0), 4) + 0.38*fbm(vec3((m-dr)*1.10, 9.0), 3);
  col += vec3(0.052,0.078,0.092) * smoothstep(0.32, 0.92, mist) * (0.45 + 0.55*smoothstep(0.0,1.2,din));

  outColor = vec4(max(col, 0.0), 1.0);
}`;

  /* ---------------- ĐOM ĐÓM ---------------- */
  const VS_FLY = `#version 300 es
precision highp float;
layout(location=0) in vec4 aBase;   // x,y (mét)  z,w = biên độ quỹ đạo
layout(location=1) in vec4 aOrb;    // tần số 1,2 (nguyên) + pha 1,2
layout(location=2) in vec4 aLook;   // size(px), độ sáng, hue, pha nhấp nháy
uniform vec2 uRes; uniform float uT; uniform float uScale;
out vec3 vCol; out float vBright;
#define TAU 6.28318530718
void main(){
  float a1 = TAU*(aOrb.x*uT + aOrb.z);
  float a2 = TAU*(aOrb.y*uT + aOrb.w);
  vec2 p = aBase.xy + aBase.z*vec2(cos(a1), sin(a1)) + aBase.w*vec2(cos(a2), sin(a2*1.0));
  vec2 px = p*uScale + uRes*0.5;
  gl_Position = vec4(px/uRes*2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = aLook.x;
  vec3 warm = vec3(1.00, 0.72, 0.30), mint = vec3(0.55, 1.00, 0.80);
  vCol = mix(warm, mint, aLook.z);
  float tw = 0.45 + 0.55*pow(max(0.0, sin(TAU*(2.0*uT + aLook.w))), 1.6);
  vBright = aLook.y * tw;
}`;

  const FS_FLY = `#version 300 es
precision highp float;
in vec3 vCol; in float vBright;
out vec4 outColor;
void main(){
  vec2 d = gl_PointCoord*2.0 - 1.0;
  float r = dot(d,d);
  if(r > 1.0) discard;
  float core = exp(-r*14.0);
  float halo = exp(-r*2.6)*0.30;
  outColor = vec4(vCol*(core + halo)*vBright, 1.0);
}`;

  /* ---------------- BLOOM ---------------- */
  const FS_BRIGHT = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D uTex; uniform float uThresh;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  outColor = vec4(c * smoothstep(uThresh, uThresh+0.28, l), 1.0);
}`;

  const FS_BLUR = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D uTex; uniform vec2 uDir;
void main(){
  vec3 s = texture(uTex, vUv).rgb * 0.227027;
  s += (texture(uTex, vUv + uDir*1.3846).rgb + texture(uTex, vUv - uDir*1.3846).rgb) * 0.316216;
  s += (texture(uTex, vUv + uDir*3.2308).rgb + texture(uTex, vUv - uDir*3.2308).rgb) * 0.070270;
  outColor = vec4(s, 1.0);
}`;

  /* ---------------- COMPOSITE ---------------- */
  const FS_COMP = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
` + COMMON + `
uniform sampler2D uScene, uBloomA, uBloomB;
uniform float uBloom, uBleed, uGrain, uExposure;

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 m  = (fc - uRes*0.5) / uScale;
  vec3 c  = texture(uScene, vUv).rgb;
  c += (texture(uBloomA, vUv).rgb*0.62 + texture(uBloomB, vUv).rgb*0.38) * uBloom;

  c *= uExposure;
  c = c / (1.0 + c*0.52);                                   // tonemap mềm, không cháy
  c = pow(max(c, 0.0), vec3(0.9091));                       // gamma nhẹ

  float g = hash31(vec3(fc, floor(uT*1800.0)));
  c += (g - 0.5) * uGrain;

  float sd = sdPoly(m);
  c *= 1.0 - smoothstep(0.0, uBleed, sd);                   // fade ra ngoài ngũ giác

  outColor = vec4(max(c, 0.0), 1.0);
}`;

  global.FloorShaders = { VS_QUAD, FS_SCENE, VS_FLY, FS_FLY, FS_BRIGHT, FS_BLUR, FS_COMP };
})(window);
