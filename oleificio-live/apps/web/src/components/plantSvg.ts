// Static plant schematic (2D) for the customer view. Injected as HTML and driven
// by real lot state (active machine, pipe fill, olive/oil flow) in PlantView.tsx.
// The design mirrors the whole line: conferimento → lavaggio → frangitura →
// gramole → decanter → separatore → olio pronto, on two production lines.

export const PLANT_CSS = `
.plant-scope{--blu:#141c28;--oro:#c9a227;--oro-chiaro:#e8cf7a;--tratto-dim:#4d586b;background:var(--blu);border-radius:16px;overflow:hidden}
.plant-scope .impianto-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.plant-scope .impianto-scroll svg{display:block;min-width:820px;width:100%}
.plant-scope .mac-trace{fill:#8b98ab;transition:fill .4s,filter .4s}
.plant-scope g.attiva .mac-trace{fill:#f2dc8e;filter:drop-shadow(0 0 5px rgba(232,207,122,.55))}
.plant-scope g.fatta .mac-trace{fill:#c3cdda}
.plant-scope g#nas .mac-trace{fill:#8b98ab}
.plant-scope .tag{fill:#22304a;stroke:none}
.plant-scope .tag-txt{fill:#c9d4e6;font:600 11px 'Source Sans 3',sans-serif}
.plant-scope g.attiva .tag{fill:var(--oro)}
.plant-scope g.attiva .tag-txt{fill:#3d3006}
.plant-scope .linea-lbl{fill:#5f7052;font:700 12px sans-serif;letter-spacing:.15em}
.plant-scope .nome-mac{fill:#8fa0b8;font:600 11px 'Source Sans 3',sans-serif;text-anchor:middle;transition:fill .4s}
.plant-scope g.attiva .nome-mac{fill:var(--oro-chiaro)}
.plant-scope .tubo-bg{stroke:#334156;stroke-width:5;fill:none;stroke-linecap:round}
.plant-scope .tubo-oro{stroke:var(--oro);stroke-width:5;fill:none;stroke-linecap:round;filter:drop-shadow(0 0 4px rgba(201,162,39,.7))}
.plant-scope .oliva{fill:var(--oro-chiaro);filter:drop-shadow(0 0 6px rgba(232,207,122,.9))}
.plant-scope .spia{fill:var(--oro-chiaro);opacity:0;transition:opacity .3s}
@keyframes plantlampeggia{50%{opacity:.25}}
.plant-scope g.attiva .spia{opacity:1;animation:plantlampeggia 1.3s ease infinite}
.plant-scope .line-sel{display:flex;gap:8px;align-items:center;padding:12px 16px 0;color:#aeb8c8;font-size:.82rem;flex-wrap:wrap}
.plant-scope .line-sel button{font:inherit;font-weight:600;border:1px solid #3a4759;background:transparent;color:#aeb8c8;border-radius:8px;padding:4px 12px;cursor:pointer}
.plant-scope .line-sel button.attivo{background:var(--oro);border-color:var(--oro);color:#3d3006}
.plant-scope .fase-banner{padding:10px 18px 16px;color:#e9edf4}
.plant-scope .fase-banner .fase-titolo{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:1.1rem;color:#fff}
.plant-scope .fase-banner p{margin:4px 0 0;font-size:.85rem;color:#aeb8c8}
@media (prefers-reduced-motion:reduce){.plant-scope *{animation:none!important;transition:none!important}}
`;

export const PLANT_SVG = `<svg viewBox="0 0 1170 392" role="img" aria-label="Schema dell'impianto: due linee complete da conferimento a olio pronto" id="svg-impianto">
<defs><pattern id="griglia" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#1a2433" stroke-width="1"/></pattern></defs>
<rect width="1170" height="392" fill="url(#griglia)"/>
<path id="tuboC" class="tubo-bg" d="M105,85 L230,72 L340,70 L440,62 L452,62"/>
<path id="tuboA" class="tubo-bg" d="M452,62 L500,88 L540,88 L604,88 L664,88 L676,70 L706,70 L745,55 L817,55 L872,55 L888,90 L926,128 L950,128 L968,95 L1000,70 L1035,70 L1080,70"/>
<path id="tuboB" class="tubo-bg" d="M452,62 L452,253 L540,253 L604,253 L664,253 L676,235 L706,235 L745,220 L817,220 L872,220 L888,255 L926,293 L950,293 L968,260 L1000,235 L1035,235 L1080,235"/>
<path id="oroC" class="tubo-oro" d="M105,85 L230,72 L340,70 L440,62 L452,62" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
<path id="oroA" class="tubo-oro" d="M452,62 L500,88 L540,88 L604,88 L664,88 L676,70 L706,70 L745,55 L817,55 L872,55 L888,90 L926,128 L950,128 L968,95 L1000,70 L1035,70 L1080,70" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
<path id="oroB" class="tubo-oro" d="M452,62 L452,253 L540,253 L604,253 L664,253 L676,235 L706,235 L745,220 L817,220 L872,220 L888,255 L926,293 L950,293 L968,260 L1000,235 L1035,235 L1080,235" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
<g id="m0"><rect class="mac-trace" x="34" y="34" width="62" height="62" rx="4"/><path class="mac-trace" d="M96,54 h14 v20 h-14 z"/><circle class="spia" cx="148" cy="80" r="3.5"/><rect class="tag" x="87" y="87" width="36" height="20" rx="3"/><text class="tag-txt" x="97" y="101">01</text></g>
<g id="nas"><rect class="mac-trace" x="0" y="55" width="150" height="20" rx="6"/></g>
<g id="m1"><rect class="mac-trace" x="0" y="40" width="154" height="46" rx="5"/><circle class="spia" cx="360" cy="60" r="3.5"/><rect class="tag" x="292" y="87" width="36" height="20" rx="3"/><text class="tag-txt" x="302" y="101">02</text></g>
<g id="m2"><rect class="mac-trace" x="0" y="22" width="120" height="60" rx="5"/><circle class="spia" cx="500" cy="55" r="3.5"/><rect class="tag" x="412" y="87" width="36" height="20" rx="3"/><text class="tag-txt" x="422" y="101">03</text></g>
<g id="gramA" transform="translate(540,0)"><rect class="mac-trace" x="10" y="38" width="117" height="74" rx="6"/><circle class="mac-trace" cx="35" cy="75" r="15"/><circle class="mac-trace" cx="68" cy="75" r="15"/><circle class="mac-trace" cx="101" cy="75" r="15"/><circle class="spia" cx="64" cy="14" r="3.5"/></g>
<g id="pompaA" transform="translate(676,42)"><rect class="mac-trace" x="18" y="13" width="22" height="44" rx="4"/><circle class="spia" cx="34" cy="8" r="3.5"/></g>
<g id="decA" transform="translate(760,14)"><rect class="mac-trace" x="16" y="36" width="70" height="46" rx="8"/><rect class="mac-trace" x="19" y="0" width="12" height="40"/><circle class="spia" cx="57" cy="6" r="3.5"/></g>
<g id="sepA" transform="translate(900,92)"><rect class="mac-trace" x="0" y="0" width="40" height="55" rx="8"/><circle class="spia" cx="44" cy="8" r="3.5"/></g>
<g id="olioA" transform="translate(980,10)"><rect class="mac-trace" x="27" y="36" width="40" height="56" rx="6"/><circle class="spia" cx="62" cy="8" r="3.5"/></g>
<g id="gramB" transform="translate(540,165)"><rect class="mac-trace" x="10" y="38" width="117" height="74" rx="6"/><circle class="mac-trace" cx="35" cy="75" r="15"/><circle class="mac-trace" cx="68" cy="75" r="15"/><circle class="mac-trace" cx="101" cy="75" r="15"/><circle class="spia" cx="64" cy="14" r="3.5"/></g>
<g id="pompaB" transform="translate(676,207)"><rect class="mac-trace" x="18" y="13" width="22" height="44" rx="4"/><circle class="spia" cx="34" cy="8" r="3.5"/></g>
<g id="decB" transform="translate(760,179)"><rect class="mac-trace" x="16" y="36" width="70" height="46" rx="8"/><rect class="mac-trace" x="19" y="0" width="12" height="40"/><circle class="spia" cx="57" cy="6" r="3.5"/></g>
<g id="sepB" transform="translate(900,257)"><rect class="mac-trace" x="0" y="0" width="40" height="55" rx="8"/><circle class="spia" cx="44" cy="8" r="3.5"/></g>
<g id="olioB" transform="translate(980,175)"><rect class="mac-trace" x="27" y="36" width="40" height="56" rx="6"/><circle class="spia" cx="62" cy="8" r="3.5"/></g>
<text class="linea-lbl" x="530" y="50">LINEA 1</text>
<text class="linea-lbl" x="530" y="215">LINEA 2</text>
<rect class="tag" x="586" y="342" width="36" height="20" rx="3"/><text class="tag-txt" x="596" y="356">04</text>
<rect class="tag" x="799" y="342" width="36" height="20" rx="3"/><text class="tag-txt" x="809" y="356">05</text>
<rect class="tag" x="1017" y="342" width="36" height="20" rx="3"/><text class="tag-txt" x="1027" y="356">06</text>
<text class="nome-mac" x="604" y="378">Gramole</text>
<text class="nome-mac" x="817" y="378">Decanter</text>
<text class="nome-mac" x="926" y="378">Separatore</text>
<text class="nome-mac" x="1035" y="378">Olio pronto</text>
<text class="nome-mac" x="105" y="378">Conferimento</text>
<text class="nome-mac" x="315" y="378">Lavaggio</text>
<text class="nome-mac" x="447" y="378">Frangitura</text>
<circle id="olivaC" class="oliva" r="6" cx="105" cy="85"/>
<circle id="olivaA" class="oliva" r="5" style="display:none"/>
<circle id="olivaB" class="oliva" r="5" style="display:none"/>
</svg>`;
