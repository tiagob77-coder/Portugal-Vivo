import React, { useState, useEffect, useRef } from 'react';

/* ---------- DATA ---------- */

const REGIONS = [
  {
    id: 'norte', idx: '01', name: 'Norte',
    tag: 'Granito, Douro, nevoeiro',
    title: 'Onde o granito canta.',
    sub: 'Vales do Douro, aldeias encosta acima, o som lento do rio a lavrar a pedra.',
    chips: ['Vinhateiro do Douro', 'Gerês', 'Guimarães', 'Braga', 'Miranda'],
    fill: 'fill-forest', pattern: true,
  },
  {
    id: 'centro', idx: '02', name: 'Centro',
    tag: 'Xisto, Estrela, pinheiro bravo',
    title: 'A espinha do país.',
    sub: 'Serra da Estrela, aldeias de xisto a arder ao fim da tarde, universidades com seis séculos.',
    chips: ['Serra da Estrela', 'Aldeias do Xisto', 'Coimbra', 'Monsanto'],
    fill: 'fill-dusk',
  },
  {
    id: 'lisboa', idx: '03', name: 'Lisboa',
    tag: 'Calçada, Tejo, fado',
    title: 'Sete colinas ao sol.',
    sub: 'Luz de azulejo, calçada polida, um miradouro de cada vez, fado que demora a acabar.',
    chips: ['Alfama', 'Sintra', 'Cascais', 'Belém', 'Arrábida'],
    fill: 'fill-terra',
  },
  {
    id: 'alentejo', idx: '04', name: 'Alentejo',
    tag: 'Planície, cortiça, silêncio',
    title: 'Devagar, que é perto.',
    sub: 'Planície dourada, sobreiros a perder de vista, tempo que se conta em vinhas e montados.',
    chips: ['Évora', 'Monsaraz', 'Marvão', 'Alqueva', 'Costa Vicentina'],
    fill: 'fill-terra',
  },
  {
    id: 'algarve', idx: '05', name: 'Algarve',
    tag: 'Falésia, laranja, sal',
    title: 'A luz amarela do sul.',
    sub: 'Falésias cor de mel, água a bater no calcário, ondas de Sagres a Tavira.',
    chips: ['Benagil', 'Ria Formosa', 'Sagres', 'Tavira', 'Monchique'],
    fill: 'fill-rust',
  },
  {
    id: 'acores', idx: '06', name: 'Açores',
    tag: 'Vulcão, hidrângea, nuvem',
    title: 'Nove ilhas, um só oceano.',
    sub: 'Crateras verdes, fumarolas no terreno, Atlântico em volta sempre.',
    chips: ['São Miguel', 'Pico', 'Terceira', 'Flores', 'Faial'],
    fill: 'fill-mint',
  },
  {
    id: 'madeira', idx: '07', name: 'Madeira',
    tag: 'Laurissilva, levada, falésia',
    title: 'Jardim no meio do mar.',
    sub: 'Floresta laurissilva, levadas que escorrem pelos montes, Funchal a acordar ao amanhecer.',
    chips: ['Funchal', 'Porto Moniz', 'Pico Ruivo', 'Porto Santo'],
    fill: 'fill-sea',
  },
];

const POIS = [
  { cat: 'Miradouro', name: 'Miradouro da Senhora do Monte', where: 'Lisboa · Graça', dist: '1,2 km', fill: 'fill-terra', rank: 'Nº 014' },
  { cat: 'Trilho', name: 'Levada do Caldeirão Verde', where: 'Madeira · Santana', dist: '12,8 km', fill: 'fill-mint', rank: 'Nº 003' },
  { cat: 'Praia', name: 'Praia da Marinha', where: 'Algarve · Lagoa', dist: '4,6 km', fill: 'fill-sea', rank: 'Nº 007' },
  { cat: 'Património', name: 'Vila-museu de Monsaraz', where: 'Alentejo · Reguengos', dist: '—', fill: 'fill-dusk', rank: 'Nº 028', wide: true },
  { cat: 'Gastronomia', name: 'Pastelaria do Rossio, 1891', where: 'Lisboa · Baixa', dist: '600 m', fill: 'fill-rust', rank: 'Nº 041' },
  { cat: 'Natureza', name: 'Caldeira das Sete Cidades', where: 'Açores · São Miguel', dist: '—', fill: 'fill-forest', rank: 'Nº 019' },
];

const LIVE = [
  { k: 'Maré em Cascais', big: '1,7', unit: 'm · a subir', extra: [['Próx. baixa', '17:42'], ['Próx. alta', '23:58']] },
  { k: 'Surf em Sagres', big: '2,1', unit: 'm · vento NE 14 kt', extra: [['Condição', 'Bom'], ['Temp. água', '16 ºC']] },
  { k: 'Combóio IC 521', big: '19:04', unit: 'Porto → Lisboa Santa Apolónia', extra: [['Plataforma', '3'], ['Atraso', '+3 min']] },
];

/* ---------- ATMOSPHERE ---------- */

function applyTime(t: string) {
  const root = document.documentElement;
  const presets: Record<string, { bg: string; text: string; sun: string; glow: string }> = {
    amanhecer: { bg: '#F5E9D6', text: '#2A2417', sun: '#F7C87A', glow: 'rgba(247,200,122,.55)' },
    manhã:     { bg: '#FAF6EE', text: '#1C1F1C', sun: '#F5C36E', glow: 'rgba(245,195,110,.55)' },
    tarde:     { bg: '#F2ECDE', text: '#1C1F1C', sun: '#E8B649', glow: 'rgba(232,182,73,.55)'  },
    entardecer:{ bg: '#E8CBB0', text: '#2A1F18', sun: '#E07B5A', glow: 'rgba(224,123,90,.65)'  },
    noite:     { bg: '#151C20', text: '#F2ECDE', sun: '#5F87AF', glow: 'rgba(95,135,175,.45)'   },
  };
  const p = presets[t] ?? presets['tarde'];
  root.style.setProperty('--bg', p.bg);
  root.style.setProperty('--text', p.text);
  root.style.setProperty('--sun', p.sun);
  root.style.setProperty('--sun-glow', p.glow);
}

/* ---------- CSS ---------- */

const CSS = `
  :root{
    --forest-500:#2E5E4E;--forest-600:#264E41;--forest-700:#1E3E34;
    --forest-800:#162E27;--forest-900:#0E1E1A;
    --terra-400:#DFAF7F;--terra-500:#C49A6C;--terra-600:#B08556;
    --rust-400:#E07B5A;--rust-500:#C65D3B;--rust-600:#A84D32;
    --ocean-500:#1F4E79;--ocean-400:#5F87AF;--ocean-300:#87A5C3;
    --azulejo:#2A6F97;
    --cal:#FAF6EE;--cal-2:#F2ECDE;--cal-3:#E8DFC9;
    --ink:#1C1F1C;--ink-2:#3A3A3A;--muted:#6B665C;
    --amarelo:#E8B649;--rosa:#E8A08A;
    --sky-a:#F3D9B1;--sky-b:#E8A080;--sky-c:#C65D3B;
    --sun:#F5C36E;--sun-glow:rgba(245,195,110,.55);
    --bg:var(--cal);--text:var(--ink);
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--text);
    font-family:"Bricolage Grotesque","Helvetica Neue",system-ui,sans-serif;
    font-optical-sizing:auto;transition:background .9s ease,color .9s ease}
  body{overflow-x:hidden}
  a{color:inherit;text-decoration:none}
  button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}
  ::selection{background:var(--rust-500);color:var(--cal)}
  .serif{font-family:"Instrument Serif",Georgia,serif;font-weight:400}
  .mono{font-family:"Geist Mono",ui-monospace,monospace;font-feature-settings:"ss01"}

  /* TOP */
  .pv-top{position:fixed;inset:0 0 auto 0;z-index:60;
    display:flex;align-items:center;justify-content:space-between;
    padding:20px 36px;mix-blend-mode:difference;color:#f5efe2}
  .pv-brand{display:flex;align-items:baseline;gap:10px;letter-spacing:-0.02em}
  .pv-brand .pt{font-weight:600;font-size:18px}
  .pv-brand .vv{font-family:"Instrument Serif",serif;font-style:italic;font-size:22px;margin-left:-4px}
  .pv-brand .dot{width:6px;height:6px;border-radius:50%;background:var(--rust-400);
    display:inline-block;margin:0 8px;transform:translateY(-2px)}
  .pv-nav{display:flex;gap:28px;font-size:13px;letter-spacing:.02em}
  .pv-nav a{opacity:.85}.pv-nav a:hover{opacity:1}
  .pv-cta{padding:10px 18px;border-radius:999px;background:var(--cal);color:var(--ink);
    font-size:13px;font-weight:500;mix-blend-mode:normal}

  /* HERO */
  .pv-hero{position:relative;min-height:100vh;overflow:hidden;padding:120px 36px 40px}
  .pv-hero-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:40px;
    align-items:end;min-height:calc(100vh - 160px)}
  @media(max-width:980px){.pv-hero-grid{grid-template-columns:1fr}}
  .pv-eyebrow{font-family:"Geist Mono",monospace;font-size:11px;letter-spacing:.22em;
    text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:10px}
  .pv-eyebrow::before{content:"";width:24px;height:1px;background:var(--ink)}
  h1.pv-display{font-family:"Bricolage Grotesque",sans-serif;font-weight:500;
    font-size:clamp(64px,9.2vw,168px);line-height:.92;letter-spacing:-0.045em;margin:18px 0 0;color:var(--ink)}
  h1.pv-display .it{font-family:"Instrument Serif",serif;font-style:italic;font-weight:400;
    letter-spacing:-0.02em;color:var(--rust-500);font-size:1.02em}
  h1.pv-display .underline{position:relative;display:inline-block}
  h1.pv-display .underline svg{position:absolute;left:-2%;right:-2%;bottom:-8%;
    width:104%;height:22%;pointer-events:none;color:var(--terra-500)}
  .pv-lede{font-size:18px;line-height:1.45;color:var(--ink-2);max-width:54ch;margin-top:28px}
  .pv-lede b{font-weight:500;color:var(--ink)}
  .pv-hero-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));
    gap:18px;margin-top:36px;max-width:560px}
  .pv-meta{border-top:1px solid rgba(28,31,28,.16);padding-top:12px}
  .pv-meta .k{font-family:"Geist Mono",monospace;font-size:10px;letter-spacing:.18em;
    text-transform:uppercase;color:var(--muted)}
  .pv-meta .v{font-size:22px;font-weight:500;margin-top:4px;letter-spacing:-.01em}
  .pv-meta .v em{font-family:"Instrument Serif",serif;font-style:italic;font-weight:400;color:var(--rust-500)}
  .pv-hero-actions{display:flex;gap:12px;margin-top:36px;flex-wrap:wrap}
  .pv-btn{padding:14px 20px;border-radius:999px;font-size:14px;font-weight:500;
    display:inline-flex;align-items:center;gap:10px;
    transition:transform .2s ease,background .2s ease}
  .pv-btn.primary{background:var(--ink);color:var(--cal)}
  .pv-btn.primary:hover{background:var(--rust-500)}
  .pv-btn.ghost{background:transparent;color:var(--ink);border:1px solid rgba(28,31,28,.22)}
  .pv-btn.ghost:hover{background:rgba(28,31,28,.05)}
  .pv-btn .arr{transition:transform .2s}.pv-btn:hover .arr{transform:translateX(3px)}
  .pv-hero-visual{position:relative;height:100%;min-height:520px}
  .pv-tile{position:absolute;border-radius:6px;overflow:hidden;
    background:linear-gradient(135deg,var(--terra-400),var(--rust-500));
    box-shadow:0 20px 60px -20px rgba(28,31,28,.25),0 1px 0 rgba(255,255,255,.4) inset;
    transition:transform .6s cubic-bezier(.2,.7,.2,1)}
  .pv-tile::after{content:"";position:absolute;inset:0;
    background:radial-gradient(120% 80% at 20% 20%,rgba(255,255,255,.18),transparent 60%),
      radial-gradient(100% 60% at 100% 100%,rgba(0,0,0,.25),transparent 60%);
    mix-blend-mode:overlay}
  .pv-tile .stripes{position:absolute;inset:0;opacity:.45;mix-blend-mode:soft-light}
  .pv-tile .label{position:absolute;left:14px;bottom:12px;color:#fff;
    font-family:"Geist Mono",monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;
    text-shadow:0 1px 2px rgba(0,0,0,.3);display:flex;align-items:center;gap:8px}
  .pv-tile .label .dot{width:5px;height:5px;border-radius:50%;background:#fff}
  .pv-tile.t1{left:6%;top:4%;width:58%;height:58%;
    background:linear-gradient(150deg,#3a7a62,#5b9b7b 40%,#c49a6c)}
  .pv-tile.t2{right:0;top:0;width:38%;height:44%;
    background:linear-gradient(160deg,#1f4e79 0%,#4ba3c3 60%,#d7e1eb)}
  .pv-tile.t3{right:2%;top:48%;width:46%;height:50%;
    background:linear-gradient(145deg,#c65d3b 0%,#e07b5a 50%,#e8b649)}
  .pv-tile.t4{left:4%;bottom:2%;width:40%;height:34%;
    background:linear-gradient(150deg,#162e27 0%,#264e41 55%,#8c7a6b)}
  .pv-sun{position:absolute;top:8%;right:18%;width:260px;height:260px;border-radius:50%;
    background:radial-gradient(circle at 40% 40%,var(--sun) 0%,var(--sun) 55%,transparent 70%);
    filter:blur(2px);box-shadow:0 0 120px 30px var(--sun-glow);
    pointer-events:none;transition:all .9s ease}
  .pv-tile-pattern-a{
    background-image:radial-gradient(circle at 50% 50%,rgba(255,255,255,.35) 0 6%,transparent 7%),
      radial-gradient(circle at 0% 0%,rgba(255,255,255,.2) 0 6%,transparent 7%),
      radial-gradient(circle at 100% 0%,rgba(255,255,255,.2) 0 6%,transparent 7%),
      radial-gradient(circle at 0% 100%,rgba(255,255,255,.2) 0 6%,transparent 7%),
      radial-gradient(circle at 100% 100%,rgba(255,255,255,.2) 0 6%,transparent 7%);
    background-size:36px 36px}

  /* TICKER */
  .pv-ticker{border-top:1px solid rgba(28,31,28,.14);border-bottom:1px solid rgba(28,31,28,.14);
    overflow:hidden;padding:14px 0;margin-top:20px;background:var(--cal-2)}
  .pv-ticker .track{display:flex;gap:48px;white-space:nowrap;
    animation:pv-slide 50s linear infinite;
    font-family:"Instrument Serif",serif;font-style:italic;font-size:28px;color:var(--ink)}
  .pv-ticker .track span{display:inline-flex;align-items:center;gap:24px}
  .pv-ticker .dot{width:6px;height:6px;border-radius:50%;background:var(--rust-500);display:inline-block}
  @keyframes pv-slide{from{transform:translateX(0)}to{transform:translateX(-50%)}}

  /* SECTION */
  .pv-section{padding:120px 36px;position:relative}
  .pv-section-head{display:grid;grid-template-columns:1fr 1fr;gap:40px;
    align-items:end;margin-bottom:64px}
  @media(max-width:820px){.pv-section-head{grid-template-columns:1fr}}
  .pv-section-head h2{font-family:"Bricolage Grotesque",sans-serif;font-weight:500;
    font-size:clamp(40px,6vw,92px);line-height:.95;letter-spacing:-0.035em;margin:14px 0 0}
  .pv-section-head h2 em{font-family:"Instrument Serif",serif;font-style:italic;
    font-weight:400;color:var(--rust-500)}
  .pv-section-head p{font-size:17px;line-height:1.55;color:var(--ink-2);max-width:46ch}

  /* REGIONS */
  .pv-regions{background:var(--cal-2);
    border-top:1px solid rgba(28,31,28,.08);border-bottom:1px solid rgba(28,31,28,.08)}
  .pv-regions-grid{display:grid;grid-template-columns:280px 1fr;gap:40px;align-items:start}
  @media(max-width:900px){.pv-regions-grid{grid-template-columns:1fr}}
  .pv-region-list{display:flex;flex-direction:column;gap:2px;
    border-top:1px solid rgba(28,31,28,.14)}
  .pv-region-item{display:flex;align-items:center;justify-content:space-between;
    padding:18px 4px;border-bottom:1px solid rgba(28,31,28,.14);
    cursor:pointer;transition:padding .25s ease,color .25s ease}
  .pv-region-item .name{font-size:22px;letter-spacing:-0.01em;font-weight:500}
  .pv-region-item .idx{font-family:"Geist Mono",monospace;font-size:11px;
    letter-spacing:.18em;color:var(--muted)}
  .pv-region-item:hover{padding-left:12px;color:var(--rust-500)}
  .pv-region-item.active{padding-left:12px}
  .pv-region-item.active .name::before{content:"";display:inline-block;
    width:8px;height:8px;border-radius:50%;background:var(--rust-500);
    margin-right:10px;transform:translateY(-3px)}
  .pv-region-stage{position:relative;aspect-ratio:16/10;border-radius:4px;overflow:hidden;
    background:var(--forest-700);box-shadow:0 40px 80px -30px rgba(28,31,28,.35)}
  .pv-region-stage .bg{position:absolute;inset:0;transition:opacity .7s ease}
  .pv-region-stage .bg.show{opacity:1}.pv-region-stage .bg.hide{opacity:0}
  .pv-region-overlay{position:absolute;inset:0;display:flex;flex-direction:column;
    justify-content:space-between;padding:28px;color:#fff}
  .pv-region-overlay .top-row{display:flex;justify-content:space-between;align-items:flex-start;
    font-family:"Geist Mono",monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.9}
  .pv-region-overlay h3{font-family:"Instrument Serif",serif;font-style:italic;font-weight:400;
    font-size:clamp(48px,6vw,96px);line-height:.95;margin:0;letter-spacing:-.02em}
  .pv-region-overlay .subtitle{font-size:14px;max-width:42ch;margin-top:8px;opacity:.95;line-height:1.45}
  .pv-region-overlay .chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
  .pv-chip{padding:6px 12px;border:1px solid rgba(255,255,255,.35);border-radius:999px;
    font-size:12px;backdrop-filter:blur(8px);background:rgba(255,255,255,.1)}

  /* CARDS */
  .pv-cards{display:grid;grid-template-columns:repeat(12,1fr);gap:20px}
  .pv-card{grid-column:span 4;background:var(--cal);border-radius:4px;overflow:hidden;
    border:1px solid rgba(28,31,28,.08);display:flex;flex-direction:column;
    transition:transform .35s ease,box-shadow .35s ease}
  .pv-card:hover{transform:translateY(-4px);box-shadow:0 30px 60px -30px rgba(28,31,28,.28)}
  .pv-card .img{aspect-ratio:4/5;position:relative;overflow:hidden}
  .pv-card .img::after{content:"";position:absolute;inset:0;
    background:linear-gradient(180deg,transparent 50%,rgba(0,0,0,.35))}
  .pv-card .cat{position:absolute;top:12px;left:12px;z-index:2;
    font-family:"Geist Mono",monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;
    padding:5px 10px;border-radius:999px;background:rgba(250,246,238,.9);color:var(--ink)}
  .pv-card .rank{position:absolute;top:12px;right:12px;z-index:2;color:#fff;
    font-family:"Geist Mono",monospace;font-size:11px;opacity:.9}
  .pv-card .body{padding:20px 18px 22px;display:flex;flex-direction:column;gap:10px;flex:1}
  .pv-card h4{margin:0;font-family:"Instrument Serif",serif;font-style:italic;font-weight:400;
    font-size:28px;line-height:1.05;letter-spacing:-.01em}
  .pv-card .meta-row{display:flex;justify-content:space-between;align-items:center;
    margin-top:auto;padding-top:14px;border-top:1px solid rgba(28,31,28,.08)}
  .pv-card .meta-row .where{font-size:12px;color:var(--muted);font-family:"Geist Mono",monospace;
    letter-spacing:.12em;text-transform:uppercase}
  .pv-card .meta-row .dist{font-size:12px;color:var(--ink)}
  .pv-card.wide{grid-column:span 8}
  @media(max-width:980px){.pv-card{grid-column:span 6}.pv-card.wide{grid-column:span 12}}
  @media(max-width:640px){.pv-card,.pv-card.wide{grid-column:span 12}}

  /* FILLS */
  .fill-forest{background:linear-gradient(155deg,#264E41,#47876F 50%,#A3C3B7)}
  .fill-terra{background:linear-gradient(155deg,#8C6A44,#C49A6C 50%,#EFD7BF)}
  .fill-ocean{background:linear-gradient(155deg,#102A40,#2A6F97 45%,#87A5C3)}
  .fill-rust{background:linear-gradient(155deg,#8A3D28,#C65D3B 50%,#E8B649)}
  .fill-mint{background:linear-gradient(155deg,#155B2D,#6BBF9A 55%,#E1EFE5)}
  .fill-dusk{background:linear-gradient(155deg,#1E3E34,#C65D3B 60%,#E8A080)}
  .fill-sea{background:linear-gradient(155deg,#0B1E2D,#1F4E79 45%,#7EC8E3)}
  .pv-grain{position:absolute;inset:0;pointer-events:none;opacity:.22;mix-blend-mode:overlay;
    background-image:repeating-linear-gradient(92deg,rgba(255,255,255,.15) 0 1px,transparent 1px 5px),
      repeating-linear-gradient(3deg,rgba(0,0,0,.15) 0 1px,transparent 1px 7px)}

  /* EXPERIENCE */
  .pv-experience{background:var(--forest-900);color:var(--cal);transition:background .9s ease}
  .pv-experience .pv-section-head h2{color:var(--cal)}
  .pv-experience .pv-section-head p{color:rgba(250,246,238,.7)}
  .pv-experience .pv-section-head h2 em{color:var(--amarelo)}
  .pv-exp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;
    border-top:1px solid rgba(255,255,255,.12)}
  @media(max-width:900px){.pv-exp-grid{grid-template-columns:repeat(2,1fr)}}
  .pv-exp{padding:36px 24px 40px;border-right:1px solid rgba(255,255,255,.12);
    border-bottom:1px solid rgba(255,255,255,.12);
    display:flex;flex-direction:column;gap:12px;min-height:340px;
    position:relative;overflow:hidden;transition:background .4s ease}
  .pv-exp:hover{background:rgba(255,255,255,.04)}
  .pv-exp .idx{font-family:"Geist Mono",monospace;font-size:11px;
    letter-spacing:.18em;color:rgba(250,246,238,.5)}
  .pv-exp h5{font-family:"Instrument Serif",serif;font-style:italic;font-weight:400;
    font-size:38px;line-height:1;letter-spacing:-.01em;margin:12px 0 0}
  .pv-exp p{font-size:14px;line-height:1.5;color:rgba(250,246,238,.75);margin:6px 0 0}
  .pv-exp .tag{margin-top:auto;font-family:"Geist Mono",monospace;
    font-size:11px;color:var(--amarelo);letter-spacing:.1em}
  .pv-exp svg.ico{position:absolute;right:-20px;bottom:-20px;width:160px;height:160px;
    opacity:.08;transition:transform .5s ease}
  .pv-exp:hover svg.ico{transform:rotate(-10deg) translate(-10px,-10px);opacity:.16}

  /* MAP */
  .pv-map-preview{position:relative;aspect-ratio:16/9;border-radius:4px;overflow:hidden;
    background:radial-gradient(100% 120% at 50% 100%,var(--ocean-300),var(--cal) 60%);
    border:1px solid rgba(28,31,28,.08)}
  .pv-map-preview svg.outline{position:absolute;inset:0;width:100%;height:100%}
  .pv-pin{position:absolute;width:14px;height:14px;border-radius:50%;
    background:var(--rust-500);
    box-shadow:0 0 0 6px rgba(198,93,59,.18),0 2px 8px rgba(0,0,0,.2);
    transform:translate(-50%,-50%);cursor:pointer;transition:transform .25s ease}
  .pv-pin:hover{transform:translate(-50%,-50%) scale(1.3)}
  .pv-pin .lbl{position:absolute;left:18px;top:-4px;white-space:nowrap;
    background:var(--ink);color:var(--cal);padding:4px 10px;border-radius:999px;
    font-family:"Geist Mono",monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;
    opacity:0;transform:translateX(-4px);transition:all .25s ease;pointer-events:none}
  .pv-pin:hover .lbl{opacity:1;transform:translateX(0)}
  .pv-pin.blue{background:var(--azulejo);box-shadow:0 0 0 6px rgba(42,111,151,.18),0 2px 8px rgba(0,0,0,.2)}
  .pv-pin.green{background:var(--forest-500);box-shadow:0 0 0 6px rgba(46,94,78,.18),0 2px 8px rgba(0,0,0,.2)}
  .pv-pin.amber{background:var(--amarelo);box-shadow:0 0 0 6px rgba(232,182,73,.22),0 2px 8px rgba(0,0,0,.2)}

  /* MOMENT */
  .pv-moment{padding:160px 36px 140px;text-align:center;position:relative;
    background:linear-gradient(180deg,var(--cal-2),var(--cal))}
  .pv-moment .q{font-family:"Instrument Serif",serif;font-style:italic;font-weight:400;
    font-size:clamp(36px,5.2vw,80px);line-height:1.05;letter-spacing:-0.02em;
    max-width:22ch;margin:0 auto;color:var(--ink)}
  .pv-moment .q span{color:var(--rust-500)}
  .pv-moment .cite{margin-top:36px;font-family:"Geist Mono",monospace;
    font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}

  /* NOW LIVE */
  .pv-live{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
  @media(max-width:820px){.pv-live{grid-template-columns:1fr}}
  .pv-live .w{background:var(--cal);border:1px solid rgba(28,31,28,.1);border-radius:4px;
    padding:22px;display:flex;flex-direction:column;gap:10px;position:relative;overflow:hidden}
  .pv-live .w .hd{display:flex;justify-content:space-between;
    font-family:"Geist Mono",monospace;font-size:11px;letter-spacing:.2em;
    text-transform:uppercase;color:var(--muted)}
  .pv-live .w .hd .blink{width:8px;height:8px;border-radius:50%;
    background:var(--rust-500);animation:pv-blink 1.2s infinite}
  @keyframes pv-blink{50%{opacity:.3}}
  .pv-live .w .big{font-family:"Bricolage Grotesque",sans-serif;font-weight:500;
    font-size:48px;letter-spacing:-0.03em;line-height:1}
  .pv-live .w .big em{font-family:"Instrument Serif",serif;font-style:italic;
    font-weight:400;color:var(--rust-500)}
  .pv-live .w .unit{font-size:13px;color:var(--muted)}
  .pv-live .w .row{display:flex;justify-content:space-between;font-size:13px;
    color:var(--ink-2);padding-top:8px;
    border-top:1px dashed rgba(28,31,28,.12);margin-top:4px}

  /* FOOTER */
  footer.pv-footer{background:var(--ink);color:var(--cal-2);padding:80px 36px 30px}
  footer.pv-footer .f-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px}
  @media(max-width:820px){footer.pv-footer .f-grid{grid-template-columns:1fr 1fr}}
  footer.pv-footer h6{font-family:"Geist Mono",monospace;font-size:11px;letter-spacing:.2em;
    text-transform:uppercase;color:rgba(250,246,238,.5);margin:0 0 18px;font-weight:400}
  footer.pv-footer ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
  footer.pv-footer a{opacity:.85;font-size:14px}
  footer.pv-footer a:hover{opacity:1;color:var(--amarelo)}
  footer.pv-footer .mega{font-family:"Bricolage Grotesque",sans-serif;font-weight:500;
    font-size:clamp(72px,16vw,280px);line-height:.85;letter-spacing:-0.05em;
    margin:60px 0 0;color:var(--cal)}
  footer.pv-footer .mega em{font-family:"Instrument Serif",serif;font-style:italic;
    font-weight:400;color:var(--amarelo)}
  footer.pv-footer .legal{display:flex;justify-content:space-between;
    border-top:1px solid rgba(250,246,238,.12);margin-top:40px;padding-top:20px;
    font-family:"Geist Mono",monospace;font-size:11px;letter-spacing:.1em;
    color:rgba(250,246,238,.45)}

  /* LUZ CONTROL */
  .pv-luz{position:fixed;right:22px;bottom:22px;z-index:50;
    background:var(--cal);border:1px solid rgba(28,31,28,.1);border-radius:999px;
    padding:6px;display:flex;align-items:center;gap:2px;
    box-shadow:0 20px 40px -20px rgba(28,31,28,.25)}
  .pv-luz button{padding:8px 14px;border-radius:999px;font-size:12px;color:var(--muted);
    font-family:"Geist Mono",monospace;letter-spacing:.12em;text-transform:uppercase}
  .pv-luz button.on{background:var(--ink);color:var(--cal)}

  /* REVEAL */
  .pv-reveal{opacity:0;transform:translateY(30px);transition:opacity .9s ease,transform .9s ease}
  .pv-reveal.in{opacity:1;transform:translateY(0)}
`;

/* ---------- ICONS ---------- */

function Ico({ name }: { name: string }) {
  return (
    <svg className="ico" viewBox="0 0 160 160" fill="none" stroke="currentColor" strokeWidth="1.4">
      {name === 'heritage' && (
        <g>
          <rect x="30" y="60" width="100" height="70" />
          <path d="M30 60 L80 20 L130 60" />
          <line x1="60" y1="130" x2="60" y2="90" />
          <line x1="100" y1="130" x2="100" y2="90" />
        </g>
      )}
      {name === 'nature' && (
        <g>
          <path d="M20 130 Q 50 70 80 90 T 140 70" />
          <path d="M20 140 Q 60 100 100 120 T 150 110" />
          <circle cx="120" cy="45" r="14" />
        </g>
      )}
      {name === 'sea' && (
        <g>
          <path d="M10 90 Q 30 70 50 90 T 90 90 T 130 90 T 150 90" />
          <path d="M10 110 Q 30 90 50 110 T 90 110 T 130 110 T 150 110" />
          <path d="M10 130 Q 30 110 50 130 T 90 130 T 130 130 T 150 130" />
        </g>
      )}
      {name === 'food' && (
        <g>
          <circle cx="80" cy="80" r="54" />
          <path d="M44 80 H 116" />
          <path d="M58 64 Q 80 48 102 64" />
          <path d="M58 96 Q 80 112 102 96" />
        </g>
      )}
    </svg>
  );
}

/* ---------- COMPONENTS ---------- */

function Top() {
  return (
    <div className="pv-top">
      <div className="pv-brand">
        <span className="pt">Portugal</span>
        <span className="dot" />
        <span className="vv">Vivo</span>
      </div>
      <nav className="pv-nav">
        <a href="#descobrir">Descobrir</a>
        <a href="#regioes">Regiões</a>
        <a href="#experiencias">Experiências</a>
        <a href="#mapa">Mapa</a>
        <a href="#agora">Agora</a>
      </nav>
      <a href="#descobrir" className="pv-cta">Abrir a aplicação →</a>
    </div>
  );
}

function Hero({ time }: { time: string }) {
  return (
    <section className="pv-hero" id="top">
      <div className="pv-sun" />
      <div className="pv-hero-grid">
        <div>
          <div className="pv-eyebrow">Luz de {time} · Edição de Primavera 2026</div>
          <h1 className="pv-display">
            Portugal<br />
            não se visita.<br />
            <span className="it underline">Habita-se
              <svg viewBox="0 0 400 40" preserveAspectRatio="none">
                <path d="M0 30 Q 100 5 200 20 T 400 10" fill="none" stroke="currentColor" strokeWidth="3" />
              </svg>
            </span>{' '}— devagar.
          </h1>
          <p className="pv-lede">
            Um atlas vivo de <b>14 mil pontos</b>, <b>350 rotas</b> e <b>2 400 narrativas</b> do
            património, da natureza e da luz que faz deste país o que é. Da planície dourada do
            Alentejo às levadas da Madeira, <b>caminhadas próprias para a hora do dia</b>.
          </p>
          <div className="pv-hero-meta">
            <div className="pv-meta">
              <div className="k">POIs cartografados</div>
              <div className="v">14 208</div>
            </div>
            <div className="pv-meta">
              <div className="k">Rotas geradas por IA</div>
              <div className="v">352</div>
            </div>
            <div className="pv-meta">
              <div className="k">Luz hoje</div>
              <div className="v"><em>{time}</em></div>
            </div>
          </div>
          <div className="pv-hero-actions">
            <a href="#regioes" className="pv-btn primary">Começar pela luz <span className="arr">→</span></a>
            <a href="#descobrir" className="pv-btn ghost">Ver a viagem <span className="arr">↓</span></a>
          </div>
        </div>
        <div className="pv-hero-visual">
          <div className="pv-tile t1 pv-tile-pattern-a">
            <div className="pv-grain" />
            <div className="label"><span className="dot" />Minho · Terraços do Douro</div>
          </div>
          <div className="pv-tile t2">
            <div className="pv-grain" />
            <div className="label"><span className="dot" />Açores · Lagoa do Fogo</div>
          </div>
          <div className="pv-tile t3">
            <div className="pv-grain" />
            <div className="label"><span className="dot" />Algarve · Benagil ao entardecer</div>
          </div>
          <div className="pv-tile t4">
            <div className="pv-grain" />
            <div className="label"><span className="dot" />Alentejo · Monsaraz, 20:11</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Ticker() {
  const items = [
    'Festa de São João · Porto', 'Fado de Coimbra · abril', 'Feira de Santa Iria · Faro',
    'Calçadas de Lisboa', 'Sardinha assada · junho', 'Levadas da Madeira',
    'Cabo de São Vicente · fim da Europa', 'Alentejo, devagar',
  ];
  const row = [...items, ...items];
  return (
    <div className="pv-ticker">
      <div className="track">
        {row.map((t, i) => (
          <span key={i}>{t}<span className="dot" /></span>
        ))}
      </div>
    </div>
  );
}

function Regions() {
  const [active, setActive] = useState(REGIONS[2]);
  return (
    <section className="pv-section pv-regions" id="regioes">
      <div className="pv-section-head">
        <div>
          <div className="pv-eyebrow">§ Regiões · cap. 01</div>
          <h2>Sete capítulos,<br />um só <em>país de luz</em>.</h2>
        </div>
        <p>Cada região tem o seu próprio horário, a sua própria cor. O Portugal Vivo lê a hora, o vento e a tua disposição antes de te mostrar o caminho.</p>
      </div>
      <div className="pv-regions-grid">
        <div className="pv-region-list">
          {REGIONS.map(r => (
            <div
              key={r.id}
              className={'pv-region-item ' + (active.id === r.id ? 'active' : '')}
              onMouseEnter={() => setActive(r)}
              onClick={() => setActive(r)}
            >
              <span className="name">{r.name}</span>
              <span className="idx">{r.idx} · {r.tag.split(',')[0]}</span>
            </div>
          ))}
        </div>
        <div className="pv-region-stage">
          {REGIONS.map(r => (
            <div
              key={r.id}
              className={'bg ' + r.fill + ' ' + (active.id === r.id ? 'show' : 'hide')}
              style={{ opacity: active.id === r.id ? 1 : 0 }}
            >
              <div className="pv-grain" />
              {r.pattern && (
                <div style={{
                  position: 'absolute', inset: 0, opacity: 0.2,
                  backgroundImage: 'radial-gradient(circle at 50% 50%,rgba(255,255,255,.4) 0 3%,transparent 4%)',
                  backgroundSize: '42px 42px',
                }} />
              )}
            </div>
          ))}
          <div className="pv-region-overlay">
            <div className="top-row">
              <span>PT · {active.idx}</span>
              <span>{active.tag}</span>
            </div>
            <div>
              <h3>{active.title}</h3>
              <div className="subtitle">{active.sub}</div>
              <div className="chips">
                {active.chips.map(c => <span key={c} className="pv-chip">{c}</span>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Discover() {
  return (
    <section className="pv-section" id="descobrir">
      <div className="pv-section-head">
        <div>
          <div className="pv-eyebrow">§ Descobrir · hoje</div>
          <h2>Seis coisas para<br />fazer <em>agora.</em></h2>
        </div>
        <p>Escolhido pelo motor Portugal Vivo IQ — combina a tua localização, a luz actual, a época do ano e a densidade de pessoas para não te mandar para um miradouro cheio.</p>
      </div>
      <div className="pv-cards">
        {POIS.map((p, i) => (
          <div key={i} className={'pv-card ' + (p.wide ? 'wide' : '')}>
            <div className={'img ' + p.fill}>
              <div className="pv-grain" />
              <div className="cat">{p.cat}</div>
              <div className="rank">{p.rank}</div>
            </div>
            <div className="body">
              <h4>{p.name}</h4>
              <div className="meta-row">
                <span className="where">{p.where}</span>
                <span className="dist">a {p.dist}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Experience() {
  const exps = [
    { idx: 'I',   title: 'Património', tag: '— castelos, azulejos, sé',   icon: 'heritage', desc: 'Vila‑museu de Monsaraz, ruínas romanas de Conímbriga, sé de Braga. Narrativas escritas por historiadores locais.' },
    { idx: 'II',  title: 'Natureza',   tag: '— trilhos, levadas, floresta', icon: 'nature',   desc: 'Laurissilva da Madeira, trilhos do Gerês, percursos do Xisto. Rotas calibradas pela tua forma física.' },
    { idx: 'III', title: 'Mar',        tag: '— praias, surf, marés',        icon: 'sea',      desc: 'Mais de 800 praias cartografadas, com bandeiras, marés e câmaras ao vivo do cabo Raso ao Porto Santo.' },
    { idx: 'IV',  title: 'Mesa',       tag: '— pão, vinho, peixe',          icon: 'food',     desc: 'Tasca de bairro ou restaurante de chef. Época do ano, produto do dia, reserva num toque.' },
  ];
  return (
    <section className="pv-section pv-experience" id="experiencias">
      <div className="pv-section-head">
        <div>
          <div className="pv-eyebrow">§ Experiências · Quatro elementos</div>
          <h2>Quatro formas<br />de <em>entrar</em>.</h2>
        </div>
        <p>Quatro portas, as mesmas que Portugal sempre abriu: a pedra, a terra, o mar e a mesa. Cada uma com a sua própria lógica, a sua própria luz.</p>
      </div>
      <div className="pv-exp-grid">
        {exps.map((e, i) => (
          <div key={i} className="pv-exp">
            <div className="idx">{e.idx}</div>
            <h5>{e.title}</h5>
            <p>{e.desc}</p>
            <div className="tag">{e.tag}</div>
            <Ico name={e.icon} />
          </div>
        ))}
      </div>
    </section>
  );
}

function MapPreview({ showPins }: { showPins: boolean }) {
  const pins = [
    { x: 46, y: 22, lbl: 'Porto',    t: 'blue'  },
    { x: 36, y: 44, lbl: 'Coimbra',  t: ''      },
    { x: 30, y: 58, lbl: 'Lisboa',   t: 'amber' },
    { x: 52, y: 70, lbl: 'Évora',    t: 'green' },
    { x: 48, y: 88, lbl: 'Sagres',   t: ''      },
    { x: 34, y: 34, lbl: 'Aveiro',   t: 'blue'  },
    { x: 58, y: 18, lbl: 'Bragança', t: 'green' },
    { x: 82, y: 78, lbl: 'Tavira',   t: 'amber' },
  ];
  return (
    <section className="pv-section" id="mapa">
      <div className="pv-section-head">
        <div>
          <div className="pv-eyebrow">§ Mapa · hoje, 14 208 pontos</div>
          <h2>Um país inteiro,<br />num único <em>gesto.</em></h2>
        </div>
        <p>Passa com o rato sobre o país. Cada ponto é um miradouro, um trilho, um pastel, um barco que ainda sai antes do pôr‑do‑sol.</p>
      </div>
      <div className="pv-map-preview">
        <svg className="outline" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pv-terra" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#C49A6C" stopOpacity=".25" />
              <stop offset="100%" stopColor="#C65D3B" stopOpacity=".35" />
            </linearGradient>
          </defs>
          <path
            d="M 35 8 Q 30 14 32 22 Q 28 30 30 38 Q 24 48 28 58 Q 22 68 26 78 Q 30 86 42 92 Q 58 96 72 92 L 82 88 L 78 72 L 70 60 L 64 50 L 60 40 L 58 28 L 52 18 L 44 10 Z"
            fill="url(#pv-terra)"
            stroke="#1C1F1C"
            strokeWidth=".4"
            strokeDasharray=".5 1"
          />
        </svg>
        {showPins && pins.map((p, i) => (
          <div key={i} className={'pv-pin ' + (p.t || '')} style={{ left: p.x + '%', top: p.y + '%' }}>
            <span className="lbl">{p.lbl}</span>
          </div>
        ))}
        <div style={{
          position: 'absolute', left: 24, bottom: 18,
          fontFamily: 'Geist Mono, monospace', fontSize: 11,
          letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)',
        }}>
          38.7223° N · 9.1393° W · esc 1:2 500 000
        </div>
      </div>
    </section>
  );
}

function NowLive() {
  return (
    <section className="pv-section" id="agora" style={{ background: 'var(--cal-2)', borderTop: '1px solid rgba(28,31,28,.08)' }}>
      <div className="pv-section-head">
        <div>
          <div className="pv-eyebrow">§ Agora · sinais em directo</div>
          <h2>O país,<br />em <em>tempo real.</em></h2>
        </div>
        <p>Marés do IPMA, surf em Sagres, combóios da CP. Tudo o que precisas para sair de casa — ou para decidir ficar.</p>
      </div>
      <div className="pv-live">
        {LIVE.map((w, i) => (
          <div key={i} className="w">
            <div className="hd">
              <span>{w.k}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="blink" />AO VIVO
              </span>
            </div>
            <div className="big">{w.big}</div>
            <div className="unit">{w.unit}</div>
            {w.extra.map((r, j) => (
              <div key={j} className="row"><span>{r[0]}</span><span>{r[1]}</span></div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Moment() {
  return (
    <section className="pv-moment">
      <div className="pv-eyebrow" style={{ justifyContent: 'center', display: 'flex' }}>§ Manifesto</div>
      <p className="q">
        &quot;O melhor de Portugal não cabe num <span>itinerário</span>. Cabe numa <span>hora</span> da tarde.&quot;
      </p>
      <div className="cite">— Portugal Vivo, edição de 2026</div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="pv-footer">
      <div className="f-grid">
        <div>
          <h6>Portugal Vivo</h6>
          <p style={{ color: 'rgba(250,246,238,.7)', fontSize: 14, lineHeight: 1.55, maxWidth: '36ch' }}>
            Uma plataforma independente de cultura, natureza e mobilidade. 19 módulos de IQ, 4 línguas, 100% offline quando precisa de ser.
          </p>
        </div>
        <div>
          <h6>Explorar</h6>
          <ul><li><a href="#mapa">Mapa</a></li><li><a href="#descobrir">Rotas</a></li><li><a href="#descobrir">Enciclopédia</a></li><li><a href="#descobrir">Coleções</a></li></ul>
        </div>
        <div>
          <h6>Pessoas</h6>
          <ul><li><a href="#descobrir">Comunidade</a></li><li><a href="#descobrir">Leaderboard</a></li><li><a href="#descobrir">Gamificação</a></li><li><a href="#descobrir">Premium</a></li></ul>
        </div>
        <div>
          <h6>Institucional</h6>
          <ul><li><a href="#descobrir">Sobre</a></li><li><a href="#descobrir">API · 260 endpoints</a></li><li><a href="#descobrir">Imprensa</a></li><li><a href="#descobrir">Contacto</a></li></ul>
        </div>
      </div>
      <div className="mega">Portugal <em>Vivo</em></div>
      <div className="legal">
        <span>© 2026 Portugal Vivo · Lisboa · Porto · Ponta Delgada</span>
        <span>pt · en · es · fr</span>
      </div>
    </footer>
  );
}

function LuzControl({ time, setTime }: { time: string; setTime: (t: string) => void }) {
  const times = ['amanhecer', 'manhã', 'tarde', 'entardecer', 'noite'];
  return (
    <div className="pv-luz">
      {times.map(t => (
        <button key={t} className={time === t ? 'on' : ''} onClick={() => setTime(t)}>{t}</button>
      ))}
    </div>
  );
}

/* ---------- ROOT ---------- */

export default function LuzDoSul() {
  const [time, setTime] = useState('tarde');
  const [showPins, setShowPins] = useState(true);

  // Inject fonts
  useEffect(() => {
    const id = 'pv-fonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700&family=Instrument+Serif:ital@0;1&family=Geist+Mono:wght@300;400;500&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // Inject CSS
  useEffect(() => {
    const id = 'pv-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
  }, []);

  // Apply time-of-day atmosphere
  useEffect(() => {
    applyTime(time);
  }, [time]);

  // Scroll reveal
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }),
      { threshold: 0.12 },
    );
    document.querySelectorAll('.pv-reveal').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div>
      <Top />
      <Hero time={time} />
      <Ticker />
      <Regions />
      <Discover />
      <Experience />
      <MapPreview showPins={showPins} />
      <NowLive />
      <Moment />
      <Footer />
      <LuzControl time={time} setTime={setTime} />
    </div>
  );
}
