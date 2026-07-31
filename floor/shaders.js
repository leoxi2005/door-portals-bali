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

  /* ---------------- SCENE: SÀN RỪNG ĐÊM (ảnh thật + ánh sáng procedural) ---------------- */
  const FS_SCENE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
` + COMMON + `
uniform sampler2D uTexA;     // nền rừng rêu (nhìn từ trên)
uniform sampler2D uTexB;     // đồng cỏ bạc
uniform float uRing;
uniform float uEmit;
uniform vec2  uDoor[9];
uniform float uDoorPh[9];

mat2 rot2(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

/* ảnh phủ đúng 1 lần cả sàn: 1 texel ~ 1 pixel, không lặp, không nhoè */
vec3 ground(sampler2D T, vec2 p, float sc, float rotA){
  return texture(T, rot2(rotA) * p / sc + 0.5).rgb;
}

/* 9 lối mòn (cỏ rạp) */
float paths(vec2 p, float ring){
  float best = 0.0;
  for(int i=0;i<9;i++){
    vec2 D = uDoor[i];
    float L = max(0.001, length(D));
    vec2 dir = -D/L, per = vec2(-dir.y, dir.x);
    vec2 rel = p - D;
    float t = dot(rel, dir), sN = dot(rel, per);
    float wob = 0.34*sin(t*1.05 + float(i)*2.3) + 0.14*sin(t*2.3 - float(i));
    float w   = 0.36 + 0.10*sin(t*0.75 + float(i));
    float d   = (sN - wob)/w;
    best = max(best, exp(-d*d*1.5)
              * smoothstep(0.0, 0.55, t)
              * smoothstep(ring*0.72, ring*1.30, length(p)));
  }
  return best;
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 m  = (fc - uRes*0.5) / uScale;
  float sd = sdPoly(m), din = -sd, r = length(m);

  /* ---- GIÓ: uốn nhẹ toạ độ lấy mẫu -> cỏ đung đưa ---- */
  float wv = sin(TAU*(dot(m, vec2(0.82, 0.58))*0.235 - uT*2.0))
           + 0.55*sin(TAU*(dot(m, vec2(-0.45, 0.89))*0.175 - uT*1.0));
  float gust = 0.55 + 0.45*fbm(vec3(m*0.6 + vec2(cos(TAU*uT), sin(TAU*uT))*1.4, 9.0), 3);
  vec2 warp = 0.016 * wv * gust * vec2(0.82, 0.58);

  /* ---- NỀN: trộn 2 ảnh thật ---- */
  float mixAB = smoothstep(0.34, 0.72, fbm(vec3(m*0.30, 51.0), 3));
  mixAB = clamp(mixAB*0.60 + 0.90*smoothstep(uRing*2.45, uRing*0.50, r), 0.0, 1.0);
  vec3 gA = ground(uTexA, m + warp, 8.60, 0.00);
  vec3 gB = ground(uTexB, m + warp, 8.60, 2.05);
  vec3 alb = mix(gA, gB, smoothstep(0.40, 0.60, mixAB));
  alb = pow(clamp(alb*1.30, 0.0, 1.0), vec3(0.94));
  float lg = dot(alb, vec3(0.299,0.587,0.114));
  alb = mix(vec3(lg), alb, 0.62);                              // bớt xanh lá gắt
  alb *= vec3(0.90, 0.97, 1.16);                               // ngả chàm cho khớp tường

  float pth = paths(m, uRing);
  alb = mix(alb, alb*vec3(1.10,1.06,1.02) + 0.030, pth*0.75);      // lối mòn: cỏ rạp, bạc hơn

  /* ---- pháp tuyến giả từ độ sáng ảnh -> ánh trăng bắt được mặt cỏ ---- */
  float lum = dot(alb, vec3(0.299,0.587,0.114));
  vec2  dpx = vec2(2.0)/uRes;
  float e2 = 2.0/uScale;
  float lxp = dot(mix(ground(uTexA, m+warp+vec2(e2,0.0), 8.60, 0.0), ground(uTexB, m+warp+vec2(e2,0.0), 8.60, 2.05), mixAB), vec3(0.33));
  float lxm = dot(mix(ground(uTexA, m+warp-vec2(e2,0.0), 8.60, 0.0), ground(uTexB, m+warp-vec2(e2,0.0), 8.60, 2.05), mixAB), vec3(0.33));
  float lyp = dot(mix(ground(uTexA, m+warp+vec2(0.0,e2), 8.60, 0.0), ground(uTexB, m+warp+vec2(0.0,e2), 8.60, 2.05), mixAB), vec3(0.33));
  float lym = dot(mix(ground(uTexA, m+warp-vec2(0.0,e2), 8.60, 0.0), ground(uTexB, m+warp-vec2(0.0,e2), 8.60, 2.05), mixAB), vec3(0.33));
  vec3 N = normalize(vec3(-(lxp-lxm)*2.4, -(lyp-lym)*2.4, 1.0));

  /* ---- ÁNH SÁNG ---- */
  vec2  cloudC = 3.4*vec2(cos(TAU*uT), sin(TAU*uT));
  float moonPatch = smoothstep(0.30, 0.74, fbm(vec3((m - cloudC)*0.26, 88.0), 3));
  float ma = TAU*uT;
  vec3  Lmoon = normalize(vec3(0.58*cos(ma), 0.58*sin(ma), 0.80));
  float dm = max(dot(N, Lmoon), 0.0);
  vec3  moonC = vec3(0.72, 0.82, 1.05);

  float inRing = smoothstep(uRing*1.35, uRing*0.45, r);
  vec3 col = alb * (0.42 + 0.55*moonPatch + 0.85*dm*(0.45+0.75*moonPatch));
  col += alb * moonC * inRing * 0.26;                        // vũng trăng giữa phòng
  col += moonC * pow(max(dot(N, normalize(Lmoon + vec3(0,0,1))), 0.0), 26.0) * 0.10*(0.4+0.6*moonPatch);
  col *= mix(vec3(0.78,0.86,1.05), vec3(1.0), moonPatch);    // vùng tối ngả lam

  /* ---- 9 VÙNG SÁNG ẤM TỪ CHÂN CỬA ---- */
  vec3 doorLit = vec3(0.0); float doorGlow = 0.0;
  for(int i=0;i<9;i++){
    vec2 dv = uDoor[i] - m;
    float dd = length(dv);
    float att = exp(-dd*0.85) * (0.66 + 0.34*sin(TAU*(uT + uDoorPh[i])));
    doorLit += vec3(1.00, 0.70, 0.40) * max(dot(N, normalize(vec3(dv, 0.60))), 0.0) * att;
    doorGlow += att;
  }
  col += alb * doorLit * 1.70;
  col += vec3(0.32, 0.18, 0.08) * doorGlow * 0.045;

  /* ---- HOA TRONG ẢNH TỰ PHÁT SÁNG (dày hơn dọc vòng giữa phòng) ---- */
  float warm = clamp((alb.r - alb.b)*3.4, 0.0, 1.0) * smoothstep(0.16, 0.42, lum);
  float ringB = exp(-pow((r - uRing)/0.65, 2.0));
  float pulse = 0.55 + 0.45*sin(TAU*(uT + r*0.35));
  col += vec3(1.00, 0.74, 0.32) * warm * uEmit * pulse * (0.80 + 1.60*ringB);
  col += vec3(1.00, 0.78, 0.38) * ringB * 0.075;

  /* ---- SƯƠNG ĐỌNG LẤP LÁNH ---- */
  float dw = fbm(vec3(m*34.0, 61.0), 2);
  float dew = smoothstep(0.855, 0.965, dw) * smoothstep(0.10, 0.45, lum);
  col += vec3(0.80,0.88,1.00) * dew * pow(max(0.0, sin(TAU*(3.0*uT + dw*11.0))), 3.0) * 0.85;

  /* ---- SƯƠNG TRÔI ---- */
  vec2 dr = 0.40*vec2(cos(TAU*uT), sin(TAU*uT));
  float mist = 0.62*fbm(vec3((m+dr)*0.58, 2.0), 3) + 0.38*fbm(vec3((m-dr)*1.05, 9.0), 3);
  col += vec3(0.085,0.100,0.145) * smoothstep(0.32, 0.92, mist) * (0.45 + 0.55*smoothstep(0.0,1.2,din));

  col *= mix(0.55, 1.0, smoothstep(0.0, 1.35, din));         // tối dần về chân tường
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
  outColor = vec4(vCol*(core + halo)*vBright*1.6, 1.0);
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
